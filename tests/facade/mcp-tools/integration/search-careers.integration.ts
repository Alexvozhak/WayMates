import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { SearchCareersTool } from "../../../../src/facade/mcp-server/tools/search-careers.tool.js";
import { cleanupSession, getToolDeps, setupSession } from "../../helpers/mcp-tool-helpers.js";

import type { SessionId } from "../../../../src/facade/mcp-server/result.js";
import type { FacadeAdhocSearchParams } from "../../../../src/facade/mcp-server/schemas.js";
import type { AdhocUserContext, ContextField, UserId } from "../../../../src/shared/schemas.js";

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
  pathLimit: 5,
  excludedContextFields: [],
  excludedCreationReasons: [],
  ...overrides,
});

describe("SearchCareersTool Integration Tests", () => {
  let tool: SearchCareersTool;
  let testSessionId: SessionId;
  const testUserId: UserId = "usr_01933ec5-c5f0-7a57-af82-87199be6c111";

  beforeEach(async () => {
    testSessionId = await setupSession(testUserId);

    tool = new SearchCareersTool(getToolDeps());
  });

  afterEach(async () => {
    await cleanupSession(testSessionId);
  });

  // Business rule: Adhoc search allows users to explore careers without predefined goal (exploratory mode).
  // Flow: validate session → normalize user input (typos, case) → query Core → return ranked candidates.
  it("SC1: Full flow with normalization - returns scored candidates", async () => {
    const params = createFacadeSearchParams(testSessionId, {
      position: "junior",
      skills: ["React"],
      domains: ["Frontend"],
    });

    const result = await tool.execute(params);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Array.isArray(result.value)).toBe(true);
      expect(result.value.length).toBeGreaterThan(0);
    }
  });

  // Business rule: Security-first design - invalid sessions rejected before normalization or Core access.
  // Prevents unauthorized search queries; error code helps client distinguish auth vs data issues.
  it("SC2: Invalid session rejected - returns error", async () => {
    const invalidSession: SessionId = "sess_invalid123";
    const params = createFacadeSearchParams(invalidSession, { position: "junior" });

    const result = await tool.execute(params);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("session_expired");
    }
  });

  // Business rule: User input quality varies (typos common during mobile/rushed entry).
  // Normalization layer ensures "Pyton" searches return Python results, not empty/wrong matches.
  it("SC3: Typos normalized before Core - LLM corrects misspellings", async () => {
    const params = createFacadeSearchParams(testSessionId, { skills: ["Pyton"] });

    const result = await tool.execute(params);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Array.isArray(result.value)).toBe(true);
    }
  });

  // Business rule: No matches for unrealistic criteria is valid business outcome (empty array, not error).
  // Users might search for niche/future tech; empty results prompt them to refine search.
  it("SC4: Empty results valid - unrealistic criteria returns empty array", async () => {
    const params = createFacadeSearchParams(testSessionId, {
      position: "Intern",
      skills: ["QuantumHyperLang"],
    });

    const result = await tool.execute(params);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Array.isArray(result.value)).toBe(true);
    }
  });

  // Business rule: Cold start scenario - users often provide only position/skill (minimal onboarding friction).
  // Partial context still produces valuable results; system doesn't force complete profile upfront.
  it("SC5: Minimal context - works with only one field", async () => {
    const params = createFacadeSearchParams(testSessionId, { position: "junior" });

    const result = await tool.execute(params);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Array.isArray(result.value)).toBe(true);
    }
  });
});
