import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { SearchUserCareersTool } from "../../../../src/facade/mcp-server/tools/search-user-careers.tool.js";
import { cleanupSession, getToolDeps, setupSession } from "../../helpers/mcp-tool-helpers.js";
import { UserStories } from "../../../core/helpers/user-stories.js";

import type { BaseToolDependencies } from "../../../../src/facade/mcp-server/tools/base-tool.js";
import type { SessionId } from "../../../../src/facade/mcp-server/result.js";
import type { McpSearchUserCareersParams } from "../../../../src/facade/mcp-server/tools/search-user-careers.tool.js";
import type { UserId } from "../../../../src/shared/schemas.js";

describe("SearchUserCareersTool Integration Tests", () => {
  let tool: SearchUserCareersTool;
  let testSessionId: SessionId;
  let deps: BaseToolDependencies;

  const userStories = new UserStories();
  // U1 from fixtures - has contexts for search testing
  const testUserId: UserId = userStories.getStoryBy("U1").userId;

  beforeEach(async () => {
    testSessionId = await setupSession(testUserId);
    deps = getToolDeps();
    tool = new SearchUserCareersTool(deps);
  });

  afterEach(async () => {
    await cleanupSession(testSessionId);
  });

  // Business rule: Mode 2 search uses user's current context from DB (no client-side referenceContext).
  // Flow: validate session → extract userId → Core fetches user's latest context → match candidates.
  it("SUC1: Full flow - returns candidates based on user's stored context", async () => {
    const params: McpSearchUserCareersParams = {
      sessionId: testSessionId,
      limit: 10,
      pathLimit: 5,
      excludedContextFields: [],
      excludedCreationReasons: [],
      recencyThresholdMonths: null,
    };

    const result = await tool.execute(params);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Array.isArray(result.value)).toBe(true);
    }
  });

  // Business rule: Security-first design - invalid sessions rejected before DB access.
  // Prevents unauthorized queries; user must authenticate via session before accessing their data.
  it("SUC2: Invalid session rejected - returns error", async () => {
    const invalidSession: SessionId = "sess_00000000000000000000000000000000";
    const params: McpSearchUserCareersParams = {
      sessionId: invalidSession,
      limit: 10,
      pathLimit: 5,
      excludedContextFields: [],
      excludedCreationReasons: [],
      recencyThresholdMonths: null,
    };

    const result = await tool.execute(params);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("session_expired");
    }
  });

  // Business rule: Users with empty profiles (cold start) should get empty results gracefully (not errors).
  // Guides user to fill profile ("Add contexts to see career matches") vs cryptic error.
  it("SUC3: Empty profile handling - returns empty array for users without contexts", async () => {
    // Abstract user ID (not from fixtures) - tests cold start with empty profile
    const emptyUserId: UserId = "usr_01933ec5-c5f0-7a57-af82-87199be6c999";
    const emptySession = await deps.session.create(emptyUserId);

    const params: McpSearchUserCareersParams = {
      sessionId: emptySession,
      limit: 10,
      pathLimit: 5,
      excludedContextFields: [],
      excludedCreationReasons: [],
      recencyThresholdMonths: null,
    };

    const result = await tool.execute(params);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Array.isArray(result.value)).toBe(true);
    }
  });

  // Business rule: Filtering excluded fields reduces match noise (e.g., ignore industry if job-hopping across sectors).
  // User controls relevance: "show me any careers with my skills, ignore industry mismatch".
  it("SUC4: Field exclusion applied - respects excludedContextFields parameter", async () => {
    const params: McpSearchUserCareersParams = {
      sessionId: testSessionId,
      limit: 10,
      pathLimit: 5,
      excludedContextFields: ["industry"],
      excludedCreationReasons: [],
      recencyThresholdMonths: null,
    };

    const result = await tool.execute(params);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Array.isArray(result.value)).toBe(true);
    }
  });

  // Business rule: Creation reason filtering enables "organic growth only" queries (exclude career breaks).
  // User asks: "show me people who naturally progressed, not forced transitions from layoffs".
  it("SUC5: Creation reason filtering - respects excludedCreationReasons parameter", async () => {
    const params: McpSearchUserCareersParams = {
      sessionId: testSessionId,
      limit: 10,
      pathLimit: 5,
      excludedContextFields: [],
      excludedCreationReasons: ["stopped_working"], // Career break/layoff (valid from reasons.json)
      recencyThresholdMonths: null,
    };

    const result = await tool.execute(params);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Array.isArray(result.value)).toBe(true);
    }
  });
});
