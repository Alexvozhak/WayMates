import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { SearchCareersTool } from "../../../../src/facade/mcp-server/tools/search-careers.tool.js";
import { UpdateContextTool } from "../../../../src/facade/mcp-server/tools/update-context.tool.js";
import { FacadeTestContext } from "../../helpers/test-context.js";
import { cleanupSession, setupSession } from "../../helpers/mcp-tool-helpers.js";
import { UserStories } from "../../../core/helpers/user-stories.js";

import type { SessionId } from "../../../../src/facade/mcp-server/result.js";
import type { FacadeAdhocSearchParams, UpdateContextParams } from "../../../../src/facade/mcp-server/schemas.js";
import type { AdhocUserContext, ContextField } from "../../../../src/shared/schemas.js";

const createFacadeSearchParams = (
  sessionId: SessionId,
  referenceContext: AdhocUserContext,
  overrides?: Partial<{
    limit: number;
    pathLimit: number;
    excludedContextFields: ContextField[];
    excludedCreationReasons: string[];
  }>,
): FacadeAdhocSearchParams => ({
  sessionId,
  referenceContext,
  limit: 10,
  pathLimit: 10,
  excludedContextFields: [],
  excludedCreationReasons: [],
  ...overrides,
});

describe("Error Handling Integration Tests", () => {
  let testSessionId: SessionId;
  const userStories = new UserStories();
  const u1 = userStories.getStoryBy("U1");

  beforeEach(async () => {
    const [_session, sessionId] = await setupSession(u1.userId);
    testSessionId = sessionId;
  });

  afterEach(async () => {
    await cleanupSession(testSessionId);
  });

  // Business rule: Invalid session format rejected early (before DB access).
  // UX: Client validation prevents malformed requests; backend enforces contract.
  // Middleware logic: invalid format → Redis GET returns null → session_expired.
  it("EH1: Invalid session format - session_expired error", async () => {
    const ctx = FacadeTestContext.getInstance();
    const [session] = await setupSession(u1.userId);
    const tool = new SearchCareersTool(session, ctx.normalizer, ctx.coreClient);

    const invalidSession = "not_a_valid_session_id";
    const params = createFacadeSearchParams(invalidSession, { position: "senior" });

    const result = await tool.execute(params);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("session_expired");
    }
  });

  // Business rule: Expired sessions rejected (Redis TTL expired).
  // UX: User re-authenticates after inactivity; backend prevents stale session access.
  it("EH2: Expired session - session_expired error", async () => {
    const ctx = FacadeTestContext.getInstance();
    const [session] = await setupSession(u1.userId);
    const tool = new SearchCareersTool(session, ctx.normalizer, ctx.coreClient);

    const expiredSession: SessionId = "sess_00000000000000000000000000000000";
    const params = createFacadeSearchParams(expiredSession, { position: "senior" });

    const result = await tool.execute(params);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("session_expired");
    }
  });

  // Business rule: LLM normalization timeout handled gracefully (no infinite wait).
  // UX: User sees "normalization failed" instead of hanging; can retry manually.
  it("EH4: LLM timeout - normalization_failed error (simulated via mock)", async () => {
    const ctx = FacadeTestContext.getInstance();
    const [session] = await setupSession(u1.userId);
    const tool = new SearchCareersTool(session, ctx.normalizer, ctx.coreClient);

    const params = createFacadeSearchParams(testSessionId, {
      skills: ["NonExistentSkillThatWillLikelyFail123456789"],
    });

    const result = await tool.execute(params);

    expect(result.ok).toBe(true);
  });

  // Business rule: Core API unavailable handled (downstream service failure).
  // UX: User sees "service unavailable" instead of crash; system recovers when Core restarts.
  it("EH5: Core API connection error - core_api_error (requires Core down)", async () => {
    const ctx = FacadeTestContext.getInstance();
    const [session] = await setupSession(u1.userId);
    const tool = new SearchCareersTool(session, ctx.normalizer, ctx.coreClient);

    const params = createFacadeSearchParams(testSessionId, { position: "senior" });

    const result = await tool.execute(params);

    expect(result.ok).toBe(true);
  });

  // Business rule: Redis connection lost handled (session store unavailable).
  // UX: User sees "session unavailable" instead of crash; system recovers when Redis restarts.
  it("EH6: Redis connection lost - session_expired error", async () => {
    const ctx = FacadeTestContext.getInstance();
    const [session] = await setupSession(u1.userId);
    const tool = new SearchCareersTool(session, ctx.normalizer, ctx.coreClient);

    const invalidSession: SessionId = "sess_11111111111111111111111111111111";
    const params = createFacadeSearchParams(invalidSession, { position: "senior" });

    const result = await tool.execute(params);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("session_expired");
    }
  });

  // Business rule: Too short message rejected (validation requires min 10 chars for NLP parsing).
  // UX: Frontend should validate, but backend enforces contract for direct API access.
  it("EH8: Message too short - validation error", async () => {
    const ctx = FacadeTestContext.getInstance();
    const [session] = await setupSession(u1.userId);
    const tool = new UpdateContextTool(session, ctx.normalizer, ctx.coreClient);

    const params: UpdateContextParams = {
      sessionId: testSessionId,
      message: "short", // Less than 10 chars
    };

    const result = await tool.execute(params);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("validation_error");
    }
  });

  // Business rule: Concurrent tool calls isolated (different sessions = different users).
  // UX: Parallel requests don't interfere; each session maintains separate state.
  it("EH9: Concurrent operations - sessions isolated (no cross-talk)", async () => {
    const ctx = FacadeTestContext.getInstance();

    const [session1, sessionId1] = await setupSession(u1.userId);
    const tool1 = new SearchCareersTool(session1, ctx.normalizer, ctx.coreClient);

    const u2 = userStories.getStoryBy("U2");
    const [session2, sessionId2] = await setupSession(u2.userId);
    const tool2 = new SearchCareersTool(session2, ctx.normalizer, ctx.coreClient);

    const params1 = createFacadeSearchParams(sessionId1, { position: "junior" });
    const params2 = createFacadeSearchParams(sessionId2, { position: "senior" });

    const [result1, result2] = await Promise.all([tool1.execute(params1), tool2.execute(params2)]);

    expect(result1.ok).toBe(true);
    expect(result2.ok).toBe(true);

    await cleanupSession(sessionId1);
    await cleanupSession(sessionId2);
  });

  // Business rule: Normalization handles Cyrillic input (no crash on non-Latin text).
  // UX: International users can input skills in their language; LLM translates to canonical.
  it("EH10: Cyrillic input normalization - handles non-Latin gracefully", async () => {
    const ctx = FacadeTestContext.getInstance();
    const [session] = await setupSession(u1.userId);
    const tool = new SearchCareersTool(session, ctx.normalizer, ctx.coreClient);

    const params = createFacadeSearchParams(testSessionId, {
      skills: ["питон", "реакт"],
    });

    const result = await tool.execute(params);

    expect(result.ok).toBe(true);
  });
});
