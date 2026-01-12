import { randomUUID } from "node:crypto";

import { targetContextSchema } from "@shared/schemas.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { GetGoalTool } from "../../../../../src/facade/mcp-server/tools/get-goal.tool.js";
import { SetGoalTool } from "../../../../../src/facade/mcp-server/tools/set-goal.tool.js";
import { UserStories } from "../../../core/helpers/user-stories.js";
import { cleanupSession, getToolDeps, setupSession } from "../../helpers/mcp-tool-helpers.js";

import type { SessionId } from "../../../../../src/facade/mcp-server/result.js";
import type { BaseToolDependencies } from "../../../../../src/facade/mcp-server/tools/base-tool.js";
import type { McpGetGoalParams, McpSetGoalParams, UserId } from "@shared/schemas.js";

describe("GetGoalTool Integration Tests", () => {
  let getTool: GetGoalTool;
  let setTool: SetGoalTool;
  let testSessionId: SessionId;
  let deps: BaseToolDependencies;

  const userStories = new UserStories();
  // Abstract user ID (not from fixtures) - tests cold start flow with fresh user
  const testUserId: UserId = "usr_01933ec5-c5f0-7a57-af82-87199be6c111";
  // U2 from fixtures - has contexts but no goal
  const userWithoutGoal: UserId = userStories.getStoryBy("U2").userId;

  beforeEach(async () => {
    testSessionId = await setupSession(testUserId);
    deps = getToolDeps();
    getTool = new GetGoalTool(deps);
    setTool = new SetGoalTool(deps);
  });

  afterEach(async () => {
    await cleanupSession(testSessionId);
  });

  // Business rule: Retrieve user's saved goal to display current career aspiration or populate search UI.
  // Flow: validate session → extract userId → Core fetches goal from DB → return target criteria.
  it("GG1: Retrieve saved goal - returns user's target context", async () => {
    const setParams: McpSetGoalParams = {
      sessionId: testSessionId,
      requestId: randomUUID(),
      targetContext: targetContextSchema.parse({
        position: { mode: "desired", values: ["senior"] },
        skills: { mode: "desired", values: ["Python"] },
      }),
    };

    await setTool.execute(setParams);

    const getParams: McpGetGoalParams = {
      sessionId: testSessionId,
      requestId: randomUUID(),
      targetUserId: null,
    };

    const result = await getTool.execute(getParams);

    expect(result.ok).toBe(true);
    if (result.ok && result.value) {
      expect(result.value.targetContext).toBeDefined();
      expect(result.value.targetContext.position?.mode).toBe("desired");
      expect(result.value.targetContext.position?.values).toContain("senior");
    }
  });

  // Business rule: User without goal (cold start or deleted goal) returns null gracefully (not error).
  // UI can prompt "Set your career goal to get personalized recommendations" vs confusing error.
  it("GG2: No goal exists - returns null for users without saved goals", async () => {
    const newSession = await deps.sessionService.create(userWithoutGoal);

    const params: McpGetGoalParams = {
      sessionId: newSession,
      requestId: randomUUID(),
      targetUserId: null,
    };

    const result = await getTool.execute(params);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBeNull();
    }
  });
});
