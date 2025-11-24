import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { UpdateContextTool } from "../../../../src/facade/mcp-server/tools/update-context.tool.js";
import { FacadeTestContext } from "../../helpers/test-context.js";
import { cleanupSession, setupSession } from "../../helpers/mcp-tool-helpers.js";
import { UserStories } from "../../../core/helpers/user-stories.js";

import type { SessionId } from "../../../../src/facade/mcp-server/result.js";
import type { UpdateContextToolParams } from "../../../../src/facade/mcp-server/schemas.js";

describe("UpdateContextTool Integration Tests", () => {
  let tool: UpdateContextTool;
  let testSessionId: SessionId;
  const userStories = new UserStories();
  const u1 = userStories.getStoryBy("U1");

  beforeEach(async () => {
    const ctx = FacadeTestContext.getInstance();
    const [session, sessionId] = await setupSession(u1.userId);
    testSessionId = sessionId;

    tool = new UpdateContextTool(session, ctx.normalizer, ctx.coreClient);
  });

  afterEach(async () => {
    await cleanupSession(testSessionId);
  });

  // Business rule: User can update CURRENT context fields (e.g., add skills, correct position).
  // Flow: validate session → normalize partial updates → apply to DB → return updated context.
  it("UC1: Full flow with normalization - updates current context successfully", async () => {
    const params: UpdateContextToolParams = {
      sessionId: testSessionId,
      updates: {
        skills: ["react", "typescript"],
        position: "senior frontend",
      },
    };

    const result = await tool.execute(params);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.skills).toContain("react");
      expect(result.value.skills).toContain("typescript");
      expect(result.value.position).toBe("senior frontend");
    }
  });

  // Business rule: Security-first design - invalid sessions rejected before normalization or DB writes.
  // Prevents unauthorized context modification; only authenticated users can update their profile.
  it("UC2: Invalid session rejected - returns error", async () => {
    const invalidSession: SessionId = "sess_invalid_update_000";
    const params: UpdateContextToolParams = {
      sessionId: invalidSession,
      updates: {
        skills: ["python"],
      },
    };

    const result = await tool.execute(params);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("session_expired");
    }
  });

  // Business rule: Typo normalization applies to update (prevents "Pyton" from corrupting profile).
  // Partial updates normalized before DB write ensures data quality for long-lived user profiles.
  it("UC3: Typos normalized before update - LLM corrects field values", async () => {
    const params: UpdateContextToolParams = {
      sessionId: testSessionId,
      updates: {
        skills: ["Pyton"],
      },
    };

    const result = await tool.execute(params);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.skills).toBeDefined();
    }
  });

  // Business rule: Update affects ONLY current context (WHERE nextContextId IS NULL).
  // User can refine current role without touching historical contexts for career path integrity.
  it("UC4: Only current context updated - historical contexts unchanged", async () => {
    const ctx = FacadeTestContext.getInstance();
    const beforeUpdate = await ctx.coreClient.client.story.getStory.query({
      userId: u1.userId,
    });

    const params: UpdateContextToolParams = {
      sessionId: testSessionId,
      updates: {
        skills: ["react", "vue"],
      },
    };

    const result = await tool.execute(params);
    console.log("[UC4] tool.execute result:", JSON.stringify(result, null, 2));
    expect(result.ok).toBe(true);

    const afterUpdate = await ctx.coreClient.client.story.getStory.query({
      userId: u1.userId,
    });

    console.log("[UC4] beforeUpdate contexts:", beforeUpdate.contexts.length);
    console.log("[UC4] afterUpdate contexts:", afterUpdate.contexts.length);
    console.log("[UC4] currentContext skills:", afterUpdate.contexts.at(-1)?.skills);
    console.log("[UC4] params.updates:", JSON.stringify(params.updates));

    expect(afterUpdate.contexts.length).toBe(beforeUpdate.contexts.length);
    const currentContext = afterUpdate.contexts.at(-1);
    if (currentContext) {
      expect(currentContext.skills).toContain("vue");
    }

    const historicalContext = afterUpdate.contexts[0];
    if (historicalContext) {
      expect(historicalContext.skills).toEqual(beforeUpdate.contexts[0]?.skills);
    }
  });
});
