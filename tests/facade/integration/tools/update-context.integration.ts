import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { UpdateContextTool } from "../../../../src/facade/mcp-server/tools/update-context.tool.js";
import { FacadeTestContext } from "../../helpers/test-context.js";
import { cleanupSession, setupSession } from "../../helpers/mcp-tool-helpers.js";
import { UserStories } from "../../../core/helpers/user-stories.js";

import type { SessionId } from "../../../../src/facade/mcp-server/result.js";
import type { UpdateContextParams } from "../../../../src/facade/mcp-server/schemas.js";

// TODO: Rewrite tests for new NLP-based update-context API
// Old API used CRUD-style { updates: { skills, position } }
// New API uses { message: "Add React to my skills" } with agent workflow
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

  it.skip("UC1: Full flow with normalization - updates current context successfully", async () => {
    const params: UpdateContextParams = {
      sessionId: testSessionId,
      message: "Add React and TypeScript to my skills, change position to senior frontend",
    };

    const result = await tool.execute(params);

    expect(result.ok).toBe(true);
  });

  it.skip("UC2: Invalid session rejected - returns error", async () => {
    const invalidSession: SessionId = "sess_invalid_update_000";
    const params: UpdateContextParams = {
      sessionId: invalidSession,
      message: "Add Python to my skills",
    };

    const result = await tool.execute(params);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("session_expired");
    }
  });

  it.skip("UC3: Typos normalized before update - LLM corrects field values", async () => {
    const params: UpdateContextParams = {
      sessionId: testSessionId,
      message: "Add Pyton to my skills",
    };

    const result = await tool.execute(params);

    expect(result.ok).toBe(true);
  });

  it.skip("UC4: Only current context updated - historical contexts unchanged", async () => {
    const ctx = FacadeTestContext.getInstance();
    const beforeUpdate = await ctx.coreClient.client.story.getStory.query({
      userId: u1.userId,
    });

    const params: UpdateContextParams = {
      sessionId: testSessionId,
      message: "Add React and Vue to my skills",
    };

    const result = await tool.execute(params);
    expect(result.ok).toBe(true);

    const afterUpdate = await ctx.coreClient.client.story.getStory.query({
      userId: u1.userId,
    });

    expect(afterUpdate.contexts.length).toBe(beforeUpdate.contexts.length);
  });
});
