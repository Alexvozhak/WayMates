import { describe, test, expect, vi, afterEach } from "vitest";
import type { Driver, Session, ManagedTransaction } from "neo4j-driver";
import * as upsertStory from "../../src/upsert-story.js";
import {
  CONTEXT_ID_PATTERN,
  TRAIL_ID_PATTERN,
  type StoryInput,
} from "../../src/schemas-zod.js";
import { loadTestData } from "../helpers/test-data-loader.js";

const CONTEXT_REGEX = new RegExp(CONTEXT_ID_PATTERN);
const TRAIL_REGEX = new RegExp(TRAIL_ID_PATTERN);

type MockRecord = {
  get: (key: string) => string | null;
};

type HandlerResult = { records: MockRecord[] };

type Handler = (
  params: Record<string, unknown>
) => Promise<HandlerResult> | HandlerResult;

function createRecord(key: string, value: string | null): MockRecord {
  return {
    get: (requested: string) => (requested === key ? value : null),
  };
}

function createMockDriver(handler: Handler) {
  const run = vi.fn(async (_query: string, params: Record<string, unknown>) =>
    handler(params)
  );

  const session = {
    executeWrite: vi.fn(
      async (work: (tx: ManagedTransaction) => Promise<HandlerResult>) =>
        work({ run } as unknown as ManagedTransaction)
    ),
    close: vi.fn().mockResolvedValue(undefined),
  } as unknown as Session;

  const driver = {
    session: vi.fn(() => session),
  } as unknown as Driver;

  return { driver, session, run };
}

describe("upsert-story unit", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("generateContextId creates valid ULID format", () => {
    const contextId = upsertStory.generateContextId();
    expect(contextId).toMatch(CONTEXT_REGEX);
  });

  test("generateTrailId produces unique IDs", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 10; i++) {
      const trailId = upsertStory.generateTrailId();
      expect(trailId).toMatch(TRAIL_REGEX);
      ids.add(trailId);
    }
    expect(ids.size).toBe(10);
  });

  test("executeUpsertStory handles empty arrays", async () => {
    const emptyStory = {
      user_id: "user_empty",
      contexts: [],
      trails: [],
    } as unknown as StoryInput;

    const { driver, session } = createMockDriver(() => ({ records: [] }));

    const result = await upsertStory.executeUpsertStory(driver, emptyStory);

    expect(result.success).toBe(true);
    expect(result.contextsCreated).toBe(0);
    expect(result.trailsCreated).toBe(0);
    expect(session.executeWrite).not.toHaveBeenCalled();
    expect(session.close).toHaveBeenCalledTimes(1);
  });

  test("upsertContext generates new IDs and updates trail references", async () => {
    const story = loadTestData("USER_001");
    story.contexts = story.contexts.slice(0, 1);
    story.trails = story.trails.slice(0, 1);

    const originalFromContextId = story.trails[0]!.from_context_id;

    const generatedContextIds: string[] = [];
    const trailCallParams: Array<{
      trail_id: string;
      from_context_id: string;
    }> = [];

    const { driver } = createMockDriver((params) => {
      if ("context" in params) {
        const { context } = params as { context: { context_id: string } };
        generatedContextIds.push(context.context_id);
        return { records: [createRecord("context_id", context.context_id)] };
      }
      if ("trail" in params) {
        const { trail_id, from_context_id } = params as {
          trail_id: string;
          from_context_id: string;
        };
        trailCallParams.push({ trail_id, from_context_id });
        return { records: [createRecord("trail_id", trail_id)] };
      }
      return { records: [] };
    });

    const result = await upsertStory.executeUpsertStory(driver, story);

    expect(result.success).toBe(true);
    expect(generatedContextIds).toHaveLength(1);
    expect(generatedContextIds[0]).toMatch(CONTEXT_REGEX);
    expect(story.trails[0]!.from_context_id).not.toBe(originalFromContextId);
    expect(story.trails[0]!.from_context_id).toBe(generatedContextIds[0]);
    expect(trailCallParams).toHaveLength(1);
    expect(trailCallParams[0]!.from_context_id).toBe(generatedContextIds[0]);
    expect(trailCallParams[0]!.trail_id).toMatch(TRAIL_REGEX);
  });

  test("error messages contain context ID when upsert fails", async () => {
    const story = loadTestData("USER_001");
    story.contexts = story.contexts.slice(0, 1);
    story.trails = story.trails.slice(0, 1);

    let capturedContextId: string | undefined;

    const { driver, session } = createMockDriver((params) => {
      if ("context" in params) {
        const { context } = params as { context: { context_id: string } };
        capturedContextId = context.context_id;
      }
      return { records: [] };
    });

    let thrownError: Error | null = null;
    try {
      await upsertStory.executeUpsertStory(driver, story);
    } catch (error) {
      thrownError = error as Error;
    }

    expect(capturedContextId).toBeDefined();
    expect(capturedContextId!).toMatch(CONTEXT_REGEX);
    expect(thrownError).toBeInstanceOf(Error);
    expect(thrownError!.message).toBe(
      `Context upsert failed: no records returned for ${capturedContextId}`
    );
    expect(session.executeWrite).toHaveBeenCalledTimes(1);
    expect(session.close).toHaveBeenCalledTimes(1);
  });
});
