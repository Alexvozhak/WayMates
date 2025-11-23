import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { GetGoalTool } from "../../../../src/facade/mcp-server/tools/get-goal.tool.js";
import { SetGoalTool } from "../../../../src/facade/mcp-server/tools/set-goal.tool.js";
import { FacadeTestContext } from "../../helpers/test-context.js";
import { cleanupSession, setupSession } from "../../helpers/mcp-tool-helpers.js";
import { UserStories } from "../../../core/helpers/user-stories.js";

import type { SessionMiddleware } from "../../../../src/facade/mcp-server/session-middleware.js";
import type { SessionId } from "../../../../src/facade/mcp-server/result.js";
import type { GetGoalParams, SetGoalParams } from "../../../../src/facade/mcp-server/schemas.js";
import type { UserId } from "../../../../src/shared/schemas.js";

describe("GetGoalTool Integration Tests", () => {
  let getTool: GetGoalTool;
  let setTool: SetGoalTool;
  let testSessionId: SessionId;
  let session: SessionMiddleware;

  const userStories = new UserStories();
  // Abstract user ID (not from fixtures) - tests cold start flow with fresh user
  const testUserId: UserId = "usr_01933ec5-c5f0-7a57-af82-87199be6c111";
  // U2 from fixtures - has contexts but no goal
  const userWithoutGoal: UserId = userStories.getStoryBy("U2").userId;

  beforeEach(async () => {
    const ctx = FacadeTestContext.getInstance();
    const [sess, sessId] = await setupSession(testUserId);
    session = sess;
    testSessionId = sessId;

    getTool = new GetGoalTool(session, ctx.normalizer, ctx.coreClient);
    setTool = new SetGoalTool(session, ctx.normalizer, ctx.coreClient);
  });

  afterEach(async () => {
    await cleanupSession(testSessionId);
  });

  // Business rule: Retrieve user's saved goal to display current career aspiration or populate search UI.
  // Flow: validate session → extract userId → Core fetches goal from DB → return target criteria.
  it("GG1: Retrieve saved goal - returns user's target context", async () => {
    const setParams: SetGoalParams = {
      sessionId: testSessionId,
      targetContext: {
        position: { mode: "desired", values: ["Senior"] },
        skills: { mode: "desired", values: ["Python"] },
      },
    };

    await setTool.execute(setParams);

    const getParams: GetGoalParams = {
      sessionId: testSessionId,
    };

    const result = await getTool.execute(getParams);

    expect(result.ok).toBe(true);
    if (result.ok && result.value) {
      expect(result.value.targetCriteria).toBeDefined();
      expect(result.value.targetCriteria.position?.mode).toBe("desired");
      expect(result.value.targetCriteria.position?.values).toContain("Senior");
    }
  });

  // Business rule: User without goal (cold start or deleted goal) returns null gracefully (not error).
  // UI can prompt "Set your career goal to get personalized recommendations" vs confusing error.
  it("GG2: No goal exists - returns null for users without saved goals", async () => {
    const newSession = await session.create(userWithoutGoal);

    const params: GetGoalParams = {
      sessionId: newSession,
    };

    const result = await getTool.execute(params);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBeNull();
    }
  });
});
