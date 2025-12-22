import { randomUUID } from "node:crypto";

import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { DeleteGoalTool } from "../../../../src/facade/mcp-server/tools/delete-goal.tool.js";
import { SetGoalTool } from "../../../../src/facade/mcp-server/tools/set-goal.tool.js";
import { cleanupSession, getToolDeps, setupSession } from "../../helpers/mcp-tool-helpers.js";
import { targetContextSchema } from "../../../../src/shared/schemas.js";

import type { SessionId } from "../../../../src/facade/mcp-server/result.js";
import type { McpDeleteGoalParams, McpSetGoalParams, UserId } from "../../../../src/shared/schemas.js";

describe("DeleteGoalTool Integration Tests", () => {
  let deleteTool: DeleteGoalTool;
  let setTool: SetGoalTool;
  let testSessionId: SessionId;
  const testUserId: UserId = "usr_01933ec5-c5f0-7a57-af82-87199be6c111";

  beforeEach(async () => {
    testSessionId = await setupSession(testUserId);

    const deps = getToolDeps();
    deleteTool = new DeleteGoalTool(deps);
    setTool = new SetGoalTool(deps);
  });

  afterEach(async () => {
    await cleanupSession(testSessionId);
  });

  // Business rule: User can delete career goal to stop goal-driven search recommendations.
  // Flow: validate session → delete goal from DB → success (idempotent).
  it("DG1: Delete existing goal - removes goal successfully", async () => {
    const setParams: McpSetGoalParams = {
      sessionId: testSessionId,
      requestId: randomUUID(),
      targetContext: targetContextSchema.parse({
        position: { mode: "desired", values: ["senior"] },
      }),
    };
    await setTool.execute(setParams);

    const deleteParams: McpDeleteGoalParams = {
      sessionId: testSessionId,
      requestId: randomUUID(),
    };

    const result = await deleteTool.execute(deleteParams);

    expect(result.ok).toBe(true);
  });

  // Business rule: Security-first design - invalid sessions rejected before DB writes.
  // Prevents unauthorized goal deletion; only authenticated users can modify their goals.
  it("DG2: Invalid session rejected - returns error", async () => {
    const invalidSession: SessionId = "sess_00000000-0000-7000-8000-000000000000";
    const params: McpDeleteGoalParams = {
      sessionId: invalidSession,
      requestId: randomUUID(),
    };

    const result = await deleteTool.execute(params);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("session_expired");
    }
  });

  // Business rule: Delete is idempotent (deleting non-existent goal succeeds - no error).
  // UX: User can safely retry delete without error; backend handles "already deleted" gracefully.
  it("DG3: Idempotent delete - deleting non-existent goal succeeds", async () => {
    const params: McpDeleteGoalParams = {
      sessionId: testSessionId,
      requestId: randomUUID(),
    };

    const result = await deleteTool.execute(params);

    expect(result.ok).toBe(true);
  });
});
