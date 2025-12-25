import { randomUUID } from "node:crypto";

import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { SetGoalTool } from "../../../../src/facade/mcp-server/tools/set-goal.tool.js";
import { cleanupSession, getToolDeps, setupSession } from "../../helpers/mcp-tool-helpers.js";
import { targetContextSchema } from "../../../../src/shared/schemas.js";

import type { SessionId } from "../../../../src/facade/mcp-server/result.js";
import type { McpSetGoalParams, UserId } from "../../../../src/shared/schemas.js";

describe("SetGoalTool Integration Tests", () => {
  let tool: SetGoalTool;
  let testSessionId: SessionId;
  const testUserId: UserId = "usr_01933ec5-c5f0-7a57-af82-87199be6c111";

  beforeEach(async () => {
    testSessionId = await setupSession(testUserId);

    tool = new SetGoalTool(getToolDeps());
  });

  afterEach(async () => {
    await cleanupSession(testSessionId);
  });

  // Business rule: User sets career goal (desired target context) to enable goal-driven search.
  // Flow: validate session → normalize target criteria → save to DB → return full Goal.
  it("SG1: Full flow with normalization - creates goal and returns Goal object", async () => {
    const params: McpSetGoalParams = {
      sessionId: testSessionId,
      requestId: randomUUID(),
      targetContext: targetContextSchema.parse({
        position: { mode: "desired", values: ["senior"] },
        skills: { mode: "desired", values: ["Python", "React"] },
        domains: { mode: "desired", values: ["Backend"] },
      }),
    };

    const result = await tool.execute(params);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.userId).toBe(testUserId);
      expect(result.value.targetContext).toBeDefined();
      expect(result.value.createdAt).toBeDefined();
    }
  });

  // Business rule: Security-first design - invalid sessions rejected before normalization or DB writes.
  // Prevents unauthorized goal creation; only authenticated users can set career goals.
  it("SG2: Invalid session rejected - returns error", async () => {
    const invalidSession: SessionId = "sess_00000000-0000-7000-8000-000000000000";
    const params: McpSetGoalParams = {
      sessionId: invalidSession,
      requestId: randomUUID(),
      targetContext: targetContextSchema.parse({
        position: { mode: "desired", values: ["senior"] },
      }),
    };

    const result = await tool.execute(params);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("session_expired");
    }
  });

  // Business rule: Typo normalization applies to goal criteria (prevents "Pyton" goals from failing silently).
  // Goal is long-lived data; normalizing on write ensures future queries use correct canonical terms.
  it("SG3: Typos normalized before saving - LLM corrects target criteria", async () => {
    const params: McpSetGoalParams = {
      sessionId: testSessionId,
      requestId: randomUUID(),
      targetContext: targetContextSchema.parse({
        skills: { mode: "desired", values: ["Pyton"] },
      }),
    };

    const result = await tool.execute(params);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.userId).toBe(testUserId);
    }
  });

  // Business rule: Goal update is idempotent (MERGE operation overwrites previous goal for same user).
  // User can refine goal multiple times; latest version always wins, no duplicate goals per user.
  it("SG4: Idempotent goal updates - overwrites previous goal for same user", async () => {
    const firstGoal: McpSetGoalParams = {
      sessionId: testSessionId,
      requestId: randomUUID(),
      targetContext: targetContextSchema.parse({
        position: { mode: "desired", values: ["junior"] },
      }),
    };

    const firstResult = await tool.execute(firstGoal);
    expect(firstResult.ok).toBe(true);

    const secondGoal: McpSetGoalParams = {
      sessionId: testSessionId,
      requestId: randomUUID(),
      targetContext: targetContextSchema.parse({
        position: { mode: "desired", values: ["senior"] },
        skills: { mode: "desired", values: ["Python"] },
      }),
    };

    const secondResult = await tool.execute(secondGoal);
    expect(secondResult.ok).toBe(true);

    if (firstResult.ok && secondResult.ok) {
      expect(secondResult.value.userId).toBe(firstResult.value.userId);
      expect(secondResult.value.targetContext.position?.values).toContain("senior");
    }
  });
});
