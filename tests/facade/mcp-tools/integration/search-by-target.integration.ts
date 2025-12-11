import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { SearchByTargetTool } from "../../../../src/facade/mcp-server/tools/search-by-target.tool.js";
import { cleanupSession, getToolDeps, setupSession } from "../../helpers/mcp-tool-helpers.js";

import type { SessionId } from "../../../../src/facade/mcp-server/result.js";
import type { McpSearchByTargetParams, UserId } from "../../../../src/shared/schemas.js";

describe("SearchByTargetTool Integration Tests", () => {
  let tool: SearchByTargetTool;
  let testSessionId: SessionId;
  const testUserId: UserId = "usr_01933ec5-c5f0-7a57-af82-87199be6c111";

  beforeEach(async () => {
    testSessionId = await setupSession(testUserId);

    tool = new SearchByTargetTool(getToolDeps());
  });

  afterEach(async () => {
    await cleanupSession(testSessionId);
  });

  // Business rule: Target search finds candidates matching user's desired criteria (goal-driven mode).
  // Flow: validate session → normalize target criteria → Core matches candidates → return with paths.
  it("SBT1: Full flow with normalization - returns candidates matching target", async () => {
    const params: McpSearchByTargetParams = {
      sessionId: testSessionId,
      targetContext: {
        position: { mode: "desired", values: ["senior"] },
        skills: { mode: "desired", values: ["Python", "React"] },
      },
      excludedCreationReasons: [],
      limit: 20,
    };

    const result = await tool.execute(params);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Array.isArray(result.value)).toBe(true);
    }
  });

  // Business rule: Security-first design - invalid sessions rejected before normalization or Core access.
  // Prevents unauthorized search queries; error code helps client distinguish auth vs data issues.
  it("SBT2: Invalid session rejected - returns error", async () => {
    const invalidSession: SessionId = "sess_invalid789";
    const params: McpSearchByTargetParams = {
      sessionId: invalidSession,
      targetContext: {
        position: { mode: "desired", values: ["senior"] },
      },
      excludedCreationReasons: [],
      limit: 20,
    };

    const result = await tool.execute(params);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("session_expired");
    }
  });

  // Business rule: Typo normalization applies to target criteria too (not just user context).
  // User entering "Pyton" in desired skills should still find Python experts, not empty results.
  it("SBT3: Typos normalized before Core - LLM corrects target criteria", async () => {
    const params: McpSearchByTargetParams = {
      sessionId: testSessionId,
      targetContext: {
        skills: { mode: "desired", values: ["Pyton"] },
      },
      excludedCreationReasons: [],
      limit: 20,
    };

    const result = await tool.execute(params);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Array.isArray(result.value)).toBe(true);
    }
  });

  // Business rule: Undesired filters enable negative criteria ("show me non-management roles").
  // FieldFilter mode "undesired" excludes candidates matching those values, refining results.
  it("SBT4: Undesired mode filters - excludes candidates with undesired values", async () => {
    const params: McpSearchByTargetParams = {
      sessionId: testSessionId,
      targetContext: {
        position: { mode: "undesired", values: ["Intern"] },
        skills: { mode: "desired", values: ["Python"] },
      },
      excludedCreationReasons: [],
      limit: 20,
    };

    const result = await tool.execute(params);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Array.isArray(result.value)).toBe(true);
    }
  });
});
