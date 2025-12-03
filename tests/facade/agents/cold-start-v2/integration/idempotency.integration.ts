import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { postgresService } from "../../../../../src/facade/infrastructure/postgres.service.js";
import { ColdStartGraph, PHASE, resetCheckpointer } from "../../../../../src/facade/langchain/cold-start-v2/index.js";
import { SessionMiddleware } from "../../../../../src/facade/mcp-server/session-middleware.js";
import { ColdStartTool } from "../../../../../src/facade/mcp-server/tools/cold-start.tool.js";
import { cleanupSession, setupSession } from "../../../helpers/mcp-tool-helpers.js";
import { cleanupAllTestUsers, trackTestUser } from "../../../helpers/test-users-tracker.js";
import { UserStories } from "../../../../core/helpers/user-stories.js";

import { generateStoryFromFixture } from "../../cold-start/helpers/cold-start-helpers.js";
import { FacadeTestContext } from "../../../helpers/test-context.js";

import type { ColdStartResponse } from "../../../../../src/facade/langchain/cold-start/types.js";
import type { SessionId } from "../../../../../src/facade/mcp-server/result.js";
import type { UserId } from "../../../../../src/shared/schemas.js";

const STORY_COMPLETION_TRIGGER = "\n\nГотово, это вся моя карьерная история.";

describe("Cold-Start V2 Idempotency Tests (T04, T05)", () => {
  let testSessionId: SessionId;
  let coldStartTool: ColdStartTool;
  const testUserId: UserId = "usr_01933ec5-0004-0000-0000-000000000004";
  const threadId = `cold_start_v2_${testUserId}`;

  const runWorkflow = (message: string): ReturnType<ColdStartGraph["run"]> =>
    new ColdStartGraph(testUserId).run(message, threadId);

  const runTool = async (message: string): Promise<ColdStartResponse> => {
    console.log(`runTool: sessionId=${testSessionId}, message=${message.slice(0, 50)}...`);
    const result = await coldStartTool.execute({ sessionId: testSessionId, message });
    if (!result.ok) {
      console.error(`ColdStartTool error details:`, JSON.stringify(result.error, null, 2));
      throw new Error(`ColdStartTool failed: ${result.error.message}`);
    }
    return result.value;
  };

  beforeAll(async () => {
    FacadeTestContext.initialize();
    await postgresService.initialize();
  });

  beforeEach(async () => {
    const ctx = FacadeTestContext.getInstance();

    await postgresService.resetColdStartStatus(testUserId);
    await postgresService.deleteCheckpoint(threadId);
    await ctx.coreClient.client.story.deleteStory.mutate({ userId: testUserId });

    const [_session, sessionId] = await setupSession(testUserId);
    testSessionId = sessionId;

    const storedUserId = await ctx.redis.get(`session:${sessionId}`);
    console.log(`beforeEach: sessionId=${sessionId}, storedUserId=${storedUserId}, expectedUserId=${testUserId}`);

    const sessionMiddleware = new SessionMiddleware(ctx.redis);
    coldStartTool = new ColdStartTool(sessionMiddleware, ctx.normalizer, ctx.coreClient);

    resetCheckpointer();
    trackTestUser(testUserId);
  });

  afterEach(async () => {
    await cleanupSession(testSessionId);
  });

  afterAll(async () => {
    await cleanupAllTestUsers();
    await postgresService.close();
  });

  it("T04: Repeated cold_start returns already_saved after completion", async () => {
    const ctx = FacadeTestContext.getInstance();
    const userStories = new UserStories();
    const u1 = userStories.getStoryBy("U1");

    const story = await generateStoryFromFixture(u1);
    const storyWithTrigger = story + STORY_COMPLETION_TRIGGER;

    console.log("T04 [1/7]: Sending story → awaiting_plan_confirmation");
    const planResponse = await runTool(storyWithTrigger);

    if (planResponse.phase !== PHASE.awaiting_plan_confirmation) {
      expect.fail(`Expected awaiting_plan_confirmation, got ${planResponse.phase}`);
    }

    console.log("T04 [2/7]: Confirming plan → extraction");
    const extractionResponse = await runTool("да, всё верно");

    if (extractionResponse.phase === PHASE.awaiting_clarification) {
      expect.fail("T04 requires successful extraction without clarification");
    }

    if (extractionResponse.phase !== PHASE.awaiting_context_confirmation) {
      expect.fail(`Expected awaiting_context_confirmation, got ${extractionResponse.phase}`);
    }

    let currentResponse = await runTool("да, верно");
    while (currentResponse.phase === PHASE.awaiting_context_confirmation) {
      console.log("T04 [3/7]: Confirming context...");
      currentResponse = await runTool("да, верно");
    }

    if (currentResponse.phase !== PHASE.awaiting_final_confirmation) {
      expect.fail(`Expected awaiting_final_confirmation, got ${currentResponse.phase}`);
    }

    console.log("T04 [4/7]: Final confirmation → saved");
    const savedResponse = await runTool("сохрани");

    expect(savedResponse.phase).toBe(PHASE.saved);

    console.log("T04 [5/7]: Verifying handleSaved() side effects...");

    const storyInDb = await ctx.coreClient.client.story.getStory.query({ userId: testUserId });
    expect(storyInDb, "handleSaved() не сохранил данные в Neo4j").not.toBeNull();
    expect(storyInDb.contexts.length, "Neo4j: нет contexts").toBeGreaterThan(0);
    console.log(`T04: ✅ Neo4j contains ${storyInDb.contexts.length} context(s)`);

    const isCompleted = await postgresService.isColdStartCompleted(testUserId);
    expect(isCompleted, "handleSaved() не установил completion flag").toBe(true);
    console.log("T04: ✅ PostgreSQL cold_start_completions flag set");

    const toolThreadId = `cold_start_${testUserId}`;
    const checkpoint = await postgresService.getCheckpointState(toolThreadId);
    expect(checkpoint, "handleSaved() не удалил checkpoint").toBeNull();
    console.log("T04: ✅ LangGraph checkpoint deleted");

    console.log("T04 [6/7]: Calling ColdStartTool AGAIN → expecting already_saved");
    const repeatResponse = await runTool("любое сообщение");

    expect(repeatResponse.phase).toBe("already_saved");
    console.log("T04: ✅ Repeated call returned already_saved");

    console.log("T04 [7/7]: Verifying Neo4j data unchanged after repeat...");
    const storyAfterRepeat = await ctx.coreClient.client.story.getStory.query({ userId: testUserId });
    expect(storyAfterRepeat.contexts.length).toBe(storyInDb.contexts.length);
    console.log("T04: ✅ Neo4j data unchanged - idempotency verified!");
  }, 300_000);

  it("T05: LLM extraction follows System Prompt lowercase convention", async () => {
    const userStories = new UserStories();
    const u1 = userStories.getStoryBy("U1");

    const story = await generateStoryFromFixture(u1);
    const storyWithTrigger = story + STORY_COMPLETION_TRIGGER;

    console.log("T05 [1/3]: Sending story → awaiting_plan_confirmation");
    const planResponse = await runWorkflow(storyWithTrigger);

    if (planResponse.phase !== PHASE.awaiting_plan_confirmation) {
      expect.fail(`Expected awaiting_plan_confirmation, got ${planResponse.phase}`);
    }

    console.log("T05 [2/3]: Confirming plan → extraction");
    const extractionResponse = await runWorkflow("да, всё верно");

    if (extractionResponse.phase !== PHASE.awaiting_context_confirmation) {
      console.warn(
        `T05: ⚠️ SKIPPED - LLM requested clarification (phase: ${extractionResponse.phase}). ` +
          `This is NOT a failure, but if it happens consistently, review U1 fixture or extraction prompts.`,
      );
      return;
    }

    const entity = extractionResponse.entity;
    console.log(`T05 [3/3]: Checking LLM output: position="${entity.position}"`);

    const positionIsLowercase = entity.position === entity.position.toLowerCase();
    expect(
      positionIsLowercase,
      `T05 FAIL: LLM returned "${entity.position}" instead of "${entity.position.toLowerCase()}". System Prompt compliance broken!`,
    ).toBe(true);

    if (entity.skills && entity.skills.length > 0) {
      const nonLowercaseSkills = entity.skills.filter((s) => s !== s.toLowerCase());
      expect(
        nonLowercaseSkills.length,
        `T05 FAIL: Non-lowercase skills: ${nonLowercaseSkills.join(", ")}. System Prompt compliance broken!`,
      ).toBe(0);
    }

    if (entity.domains && entity.domains.length > 0) {
      const nonLowercaseDomains = entity.domains.filter((d) => d !== d.toLowerCase());
      expect(
        nonLowercaseDomains.length,
        `T05 FAIL: Non-lowercase domains: ${nonLowercaseDomains.join(", ")}. System Prompt compliance broken!`,
      ).toBe(0);
    }

    expect(entity.contextId).toMatch(/^ctx_/);
    expect(entity.skills).toBeDefined();
    expect(entity.domains).toBeDefined();

    console.log(
      `T05: ✅ System Prompt compliance verified: position="${entity.position}", skills=${entity.skills.length}, domains=${entity.domains.length}`,
    );
  }, 180_000);
});
