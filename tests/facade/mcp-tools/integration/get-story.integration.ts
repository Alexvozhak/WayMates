import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { GetStoryTool } from "../../../../src/facade/mcp-server/tools/get-story.tool.js";
import { cleanupSession, getToolDeps, setupSession } from "../../helpers/mcp-tool-helpers.js";
import { UserStories } from "../../../core/helpers/user-stories.js";

import type { SessionId } from "../../../../src/facade/mcp-server/result.js";
import type { GetStoryParams } from "../../../../src/facade/mcp-server/schemas.js";

describe("GetStoryTool Integration Tests", () => {
  let tool: GetStoryTool;
  let testSessionId: SessionId;
  const userStories = new UserStories();
  const u1 = userStories.getStoryBy("U1");
  const u2 = userStories.getStoryBy("U2");

  beforeEach(async () => {
    testSessionId = await setupSession(u1.userId);

    tool = new GetStoryTool(getToolDeps());
  });

  afterEach(async () => {
    await cleanupSession(testSessionId);
  });

  // Business rule: User can retrieve their own profile (contexts + trails).
  // Flow: validate session → fetch from DB → return StoryInput for display/editing.
  it("GS1: Retrieve own story - returns full profile with contexts and trails", async () => {
    const params: GetStoryParams = {
      sessionId: testSessionId,
    };

    const result = await tool.execute(params);

    if (!result.ok) {
      console.error("GS1 failed:", result.error);
    }
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.userId).toBe(u1.userId);
      expect(result.value.contexts.length).toBeGreaterThan(0);
      expect(result.value.trails).toBeDefined();
    }
  });

  // Business rule: Security-first design - invalid sessions rejected before DB reads.
  // Prevents unauthorized profile access; only authenticated users can retrieve stories.
  it("GS2: Invalid session rejected - returns error", async () => {
    const invalidSession: SessionId = "sess_invalid_get_story_000";
    const params: GetStoryParams = {
      sessionId: invalidSession,
    };

    const result = await tool.execute(params);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("session_expired");
    }
  });

  // Business rule: User can request any userId (own or other user's profile for viewing).
  // Use case: Social feature - viewing other users' career paths for inspiration.
  it("GS3: Retrieve other user's story - targetUserId overrides session userId", async () => {
    const params: GetStoryParams = {
      sessionId: testSessionId,
      targetUserId: u2.userId,
    };

    const result = await tool.execute(params);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.userId).toBe(u2.userId);
      expect(result.value.contexts.length).toBeGreaterThan(0);
    }
  });

  // Business rule: Empty profile returns empty arrays (not null/error).
  // UX: New users without contexts get valid empty StoryInput for cold-start flow.
  it("GS4: Empty profile returns empty arrays - no error for new users", async () => {
    const newUserId = "usr_01933ec5-c5f0-7a57-af82-87199be6dddd";
    const newSessionId = await setupSession(newUserId);
    const newTool = new GetStoryTool(getToolDeps());

    const params: GetStoryParams = {
      sessionId: newSessionId,
    };

    const result = await newTool.execute(params);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.userId).toBe(newUserId);
      expect(result.value.contexts).toEqual([]);
      expect(result.value.trails).toEqual([]);
    }

    await cleanupSession(newSessionId);
  });
});
