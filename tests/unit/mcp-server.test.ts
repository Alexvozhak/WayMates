import { describe, test, expect, beforeEach, vi } from "vitest";
import type { Driver } from "neo4j-driver";
import { ZodError } from "zod";
import { loadTestData } from "../helpers/test-data-loader.js";
import { PresetsManager } from "../../src/orcestrator/preset-manager.js";

const {
  mockExecuteCurrentToTarget,
  mockExecuteCurrentOnly,
  mockExecuteTargetOnly,
  mockExecuteTargetSearch,
  mockExecuteUpsertStory,
  mockExecuteUpsertContexts,
  mockExecuteUpsertTrails,
  mockGetUserStory,
  mockDeleteContext,
  mockDeleteTrail,
  mockPingDatabase,
} = vi.hoisted(() => ({
  mockExecuteCurrentToTarget: vi
    .fn()
    .mockResolvedValue({ tool: "current_to_target" }),
  mockExecuteCurrentOnly: vi.fn().mockResolvedValue({ tool: "current_only" }),
  mockExecuteTargetOnly: vi.fn().mockResolvedValue({ tool: "target_only" }),
  mockExecuteTargetSearch: vi.fn().mockResolvedValue({ tool: "target_search" }),
  mockExecuteUpsertStory: vi.fn().mockResolvedValue({ success: true }),
  mockExecuteUpsertContexts: vi.fn().mockResolvedValue(new Map()),
  mockExecuteUpsertTrails: vi.fn().mockResolvedValue([]),
  mockGetUserStory: vi.fn().mockResolvedValue({ user_id: "usr_mock" }),
  mockDeleteContext: vi.fn().mockResolvedValue({ deleted: true }),
  mockDeleteTrail: vi.fn().mockResolvedValue({ deleted: true }),
  mockPingDatabase: vi.fn().mockResolvedValue({
    status: "ok",
    timestamp: "2025-01-01T00:00:00.000Z",
  }),
}));

const fastMCPInstances: MockFastMCP[] = [];

class MockFastMCP {
  public tools: Array<{
    name: string;
    description?: string;
    parameters: unknown;
    execute: (args: unknown) => Promise<string>;
  }> = [];

  constructor(public options: Record<string, unknown>) {
    fastMCPInstances.push(this);
  }

  addTool(tool: (typeof this.tools)[number]) {
    this.tools.push(tool);
  }

  addPrompt() {}
  addResource() {}
  addResourceTemplate() {}
}

vi.mock("fastmcp", () => ({
  FastMCP: MockFastMCP,
}));

vi.mock("../../src/search-modes/current-to-target.js", () => ({
  executeCurrentToTarget: mockExecuteCurrentToTarget,
}));
vi.mock("../../src/search-modes/current-only.js", () => ({
  executeCurrentOnly: mockExecuteCurrentOnly,
}));
vi.mock("../../src/search-modes/target-only.js", () => ({
  executeTargetOnly: mockExecuteTargetOnly,
}));
vi.mock("../../src/search-modes/target-search.js", () => ({
  executeTargetSearch: mockExecuteTargetSearch,
}));
vi.mock("../../src/upsert-story.js", () => ({
  executeUpsertStory: mockExecuteUpsertStory,
  executeUpsertContexts: mockExecuteUpsertContexts,
  executeUpsertTrails: mockExecuteUpsertTrails,
}));

vi.mock("../../src/mcp-tools.js", () => ({
  getUserStory: mockGetUserStory,
  deleteContext: mockDeleteContext,
  deleteTrail: mockDeleteTrail,
  pingDatabase: mockPingDatabase,
}));

const { createWayMatesServer } = await import("../../src/mcp-server.js");

describe("createWayMatesServer", () => {
  const driverStub = {} as Driver;
  const presetsStub = new PresetsManager("config/presets.json");

  beforeEach(() => {
    fastMCPInstances.length = 0;
    vi.clearAllMocks();
  });

  test("configures FastMCP server metadata", () => {
    createWayMatesServer(driverStub, presetsStub);
    const instance = fastMCPInstances.at(-1);
    expect(instance).toBeDefined();
    expect(instance!.options.name).toBe("waymates-search");
    expect(instance!.options.version).toBe("1.0.0");
    expect(instance!.options.instructions).toContain("WayMates career search");
  });

  test("registers all expected tools", () => {
    createWayMatesServer(driverStub, presetsStub);
    const instance = fastMCPInstances.at(-1)!;
    const toolNames = instance.tools.map((tool) => tool.name);
    expect(toolNames).toEqual([
      "current_to_target",
      "current_only",
      "target_only",
      "target_search",
      "execute_upsert_story",
      "upsert_context",
      "upsert_trail",
      "get_user_story",
      "delete_context",
      "delete_trail",
      "ping",
      "load_presets",
      "get_preset",
      "get_presets",
    ]);
  });

  test("wraps handlers with Zod validation and JSON serialization", async () => {
    const story = loadTestData("USER_001");
    createWayMatesServer(driverStub, presetsStub);
    const instance = fastMCPInstances.at(-1)!;
    const tool = instance.tools.find((t) => t.name === "execute_upsert_story")!;

    const response = await tool.execute(story);

    expect(mockExecuteUpsertStory).toHaveBeenCalledWith(driverStub, story);
    expect(response).toBe(JSON.stringify({ success: true }, null, 2));

    await expect(tool.execute({})).rejects.toBeInstanceOf(ZodError);
  });

  test("each search tool delegates to its handler", async () => {
    createWayMatesServer(driverStub, presetsStub);
    const instance = fastMCPInstances.at(-1)!;
    const story = loadTestData("USER_001");
    const baseConstraints = {
      max_timing_diff_months: 12,
      timing_diff_threshold_percent: 25,
      max_experience_diff_months: 60,
      results_limit: 10,
    } as const;

    const searchArgs = {
      current_to_target: {
        currentContext: story.contexts[0],
        targetContext: story.contexts[1] ?? story.contexts[0],
        searchConstraints: baseConstraints,
      },
      current_only: {
        currentContext: story.contexts[0],
        lookAheadMonths: 12,
        reasonsToTrack: story.contexts[0]?.creation_reason,
        searchConstraints: baseConstraints,
        maxUsers: 5,
      },
      target_only: {
        targetContext: story.contexts[1] ?? story.contexts[0],
        searchConstraints: baseConstraints,
      },
      target_search: {
        targetContext: story.contexts[1] ?? story.contexts[0],
        searchConstraints: baseConstraints,
      },
    } as const;

    for (const tool of instance.tools.filter((t) =>
      [
        "current_to_target",
        "current_only",
        "target_only",
        "target_search",
      ].includes(t.name)
    )) {
      const args = searchArgs[tool.name as keyof typeof searchArgs];
      mockExecuteCurrentToTarget.mockClear();
      mockExecuteCurrentOnly.mockClear();
      mockExecuteTargetOnly.mockClear();
      mockExecuteTargetSearch.mockClear();

      await tool.execute(args);

      switch (tool.name) {
        case "current_to_target":
          expect(mockExecuteCurrentToTarget).toHaveBeenCalledWith(
            driverStub,
            args
          );
          break;
        case "current_only":
          expect(mockExecuteCurrentOnly).toHaveBeenCalledWith(driverStub, args);
          break;
        case "target_only":
          expect(mockExecuteTargetOnly).toHaveBeenCalledWith(driverStub, args);
          break;
        case "target_search":
          expect(mockExecuteTargetSearch).toHaveBeenCalledWith(
            driverStub,
            args
          );
          break;
      }
    }
  });

  test("maintenance tools delegate to their handlers", async () => {
    const story = loadTestData("USER_001");
    createWayMatesServer(driverStub, presetsStub);
    const instance = fastMCPInstances.at(-1)!;

    const getUserStoryTool = instance.tools.find(
      (t) => t.name === "get_user_story"
    )!;
    const deleteContextTool = instance.tools.find(
      (t) => t.name === "delete_context"
    )!;
    const deleteTrailTool = instance.tools.find(
      (t) => t.name === "delete_trail"
    )!;
    const pingTool = instance.tools.find((t) => t.name === "ping")!;

    await getUserStoryTool.execute({ user_id: story.user_id });
    expect(mockGetUserStory).toHaveBeenCalledWith(driverStub, {
      user_id: story.user_id,
    });

    await deleteContextTool.execute({
      user_id: story.user_id,
      context_id: "ctx_01K6GSWTH2CQGVFFSG1A9VPG63",
    });
    expect(mockDeleteContext).toHaveBeenCalledWith(driverStub, {
      user_id: story.user_id,
      context_id: "ctx_01K6GSWTH2CQGVFFSG1A9VPG63",
    });

    await deleteTrailTool.execute({
      user_id: story.user_id,
      trail_id: "trl_01K6GSWTH2CQGVFFSG1A9VPG63",
    });
    expect(mockDeleteTrail).toHaveBeenCalledWith(driverStub, {
      user_id: story.user_id,
      trail_id: "trl_01K6GSWTH2CQGVFFSG1A9VPG63",
    });

    const pingResponse = await pingTool.execute({});
    expect(mockPingDatabase).toHaveBeenCalledWith(driverStub);
    expect(JSON.parse(pingResponse)).toEqual({
      status: "ok",
      timestamp: "2025-01-01T00:00:00.000Z",
    });
  });
});
