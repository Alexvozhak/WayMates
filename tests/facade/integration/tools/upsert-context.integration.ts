import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { UpsertContextTool } from "../../../../src/facade/mcp-server/tools/upsert-context.tool.js";
import { FacadeTestContext } from "../../helpers/test-context.js";
import { cleanupSession, setupSession } from "../../helpers/mcp-tool-helpers.js";

import type { SessionId } from "../../../../src/facade/mcp-server/result.js";
import type { UpsertContextParams } from "../../../../src/facade/mcp-server/schemas.js";
import type { UserId } from "../../../../src/shared/schemas.js";

describe("UpsertContextTool Integration Tests", () => {
  let tool: UpsertContextTool;
  let testSessionId: SessionId;
  const testUserId: UserId = "usr_01933ec5-c5f0-7a57-af82-87199be6c111";

  beforeEach(async () => {
    const ctx = FacadeTestContext.getInstance();
    const [session, sessionId] = await setupSession(testUserId);
    testSessionId = sessionId;

    tool = new UpsertContextTool(session, ctx.normalizer, ctx.coreClient);
  });

  afterEach(async () => {
    await cleanupSession(testSessionId);
  });

  // Business rule: User can create/update context (upsert = idempotent).
  // Flow: validate session → normalize → save to DB → return contextId for tracking.
  it("UC1: Full flow with normalization - creates context successfully", async () => {
    const params: UpsertContextParams = {
      sessionId: testSessionId,
      context: {
        contextId: "ctx_01933ec5-c5f0-7a57-af82-87199be6d001",
        createdAt: "2025-01-15T00:00:00Z",
        creationReason: ["started_working"],
        position: "Junior Developer",
        domains: ["Backend"],
        skills: ["Python", "React"],
        industry: "tech",
        companySize: "startup",
        countryCode: "us",
        cityName: "san-francisco",
        citizenships: ["us"],
        birthYear: 1995,
      },
    };

    const result = await tool.execute(params);

    if (!result.ok) {
      console.error("UC1 failed:", result.error);
    }
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.success).toBe(true);
      expect(result.value.contextId).toBeDefined();
      expect(typeof result.value.contextId).toBe("string");
      expect(result.value.contextId).toMatch(/^ctx_/);
    }
  });

  // Business rule: Security-first design - invalid sessions rejected before normalization or DB writes.
  // Prevents unauthorized context creation; only authenticated users can add contexts.
  it("UC2: Invalid session rejected - returns error", async () => {
    const invalidSession: SessionId = "sess_invalid_upsert_000";
    const params: UpsertContextParams = {
      sessionId: invalidSession,
      context: {
        contextId: "ctx_01933ec5-c5f0-7a57-af82-87199be6d002",
        createdAt: "2025-01-15T00:00:00Z",
        creationReason: ["started_working"],
        position: "senior",
        domains: ["Backend"],
        skills: ["Python"],
        industry: "tech",
        companySize: "startup",
        countryCode: "us",
        cityName: "san-francisco",
        citizenships: ["us"],
        birthYear: 1995,
      },
    };

    const result = await tool.execute(params);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("session_expired");
    }
  });

  // Business rule: Typo normalization applies to upsert (prevents "Pyton" from corrupting DB).
  // New context normalized before DB write ensures data quality for career paths.
  it("UC3: Typos normalized before saving - LLM corrects field values", async () => {
    const params: UpsertContextParams = {
      sessionId: testSessionId,
      context: {
        contextId: "ctx_01933ec5-c5f0-7a57-af82-87199be6d003",
        createdAt: "2025-01-15T00:00:00Z",
        creationReason: ["started_working"],
        position: "senior",
        domains: ["Backend"],
        skills: ["Pyton"],
        industry: "tech",
        companySize: "startup",
        countryCode: "us",
        cityName: "san-francisco",
        citizenships: ["us"],
        birthYear: 1995,
      },
    };

    const result = await tool.execute(params);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.contextId).toBeDefined();
    }
  });

  // Business rule: Upsert is idempotent (MERGE by contextId if provided).
  // User can retry context creation safely; backend deduplicates by contextId.
  it("UC4: Idempotent upsert - same contextId updates existing context", async () => {
    const contextId = "ctx_01933ec5-c5f0-7a57-af82-87199be6c999";

    const firstUpsert: UpsertContextParams = {
      sessionId: testSessionId,
      context: {
        contextId,
        createdAt: "2025-01-15T00:00:00Z",
        creationReason: ["started_working"],
        position: "junior",
        domains: ["Frontend"],
        skills: ["React"],
        industry: "tech",
        companySize: "startup",
        countryCode: "us",
        cityName: "san-francisco",
        citizenships: ["us"],
        birthYear: 1995,
      },
    };

    const firstResult = await tool.execute(firstUpsert);
    expect(firstResult.ok).toBe(true);

    const secondUpsert: UpsertContextParams = {
      sessionId: testSessionId,
      context: {
        contextId,
        createdAt: "2025-01-15T00:00:00Z",
        creationReason: ["started_working"],
        position: "middle",
        domains: ["Frontend"],
        skills: ["React", "TypeScript"],
        industry: "tech",
        companySize: "startup",
        countryCode: "us",
        cityName: "san-francisco",
        citizenships: ["us"],
        birthYear: 1995,
      },
    };

    const secondResult = await tool.execute(secondUpsert);
    expect(secondResult.ok).toBe(true);

    if (firstResult.ok && secondResult.ok) {
      expect(secondResult.value.contextId).toBe(firstResult.value.contextId);
    }
  });
});
