import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { DeleteContextTool } from "../../../../src/facade/mcp-server/tools/delete-context.tool.js";
import { UpsertContextTool } from "../../../../src/facade/mcp-server/tools/upsert-context.tool.js";
import { FacadeTestContext } from "../../helpers/test-context.js";
import { cleanupSession, setupSession } from "../../helpers/mcp-tool-helpers.js";

import type { SessionId } from "../../../../src/facade/mcp-server/result.js";
import type {
  DeleteContextParams,
  UpsertContextParams,
} from "../../../../src/facade/mcp-server/schemas.js";
import type { ContextId, UserId } from "../../../../src/shared/schemas.js";

describe("DeleteContextTool Integration Tests", () => {
  let deleteTool: DeleteContextTool;
  let upsertTool: UpsertContextTool;
  let testSessionId: SessionId;
  const testUserId: UserId = "usr_01933ec5-c5f0-7a57-af82-87199be6c111";

  beforeEach(async () => {
    const ctx = FacadeTestContext.getInstance();
    const [session, sessionId] = await setupSession(testUserId);
    testSessionId = sessionId;

    deleteTool = new DeleteContextTool(session, ctx.normalizer, ctx.coreClient);
    upsertTool = new UpsertContextTool(session, ctx.normalizer, ctx.coreClient);
  });

  afterEach(async () => {
    await cleanupSession(testSessionId);
  });

  // Business rule: User can delete context to clean up incorrect/outdated career history.
  // Flow: validate session → delete from DB → success (context and relationships removed).
  it("DC1: Delete existing context - removes context successfully", async () => {
    const contextId: ContextId = "ctx_01933ec5-c5f0-7a57-af82-87199be6caaa";
    const upsertParams: UpsertContextParams = {
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
    await upsertTool.execute(upsertParams);

    const deleteParams: DeleteContextParams = {
      sessionId: testSessionId,
      contextId,
    };

    const result = await deleteTool.execute(deleteParams);

    if (!result.ok) {
      console.error("DC1 failed:", result.error);
    }
    expect(result.ok).toBe(true);
  });

  // Business rule: Security-first design - invalid sessions rejected before DB writes.
  // Prevents unauthorized context deletion; only authenticated users can modify their history.
  it("DC2: Invalid session rejected - returns error", async () => {
    const invalidSession: SessionId = "sess_invalid_delete_ctx_000";
    const params: DeleteContextParams = {
      sessionId: invalidSession,
      contextId: "ctx_01933ec5-c5f0-7a57-af82-87199be6cbbb",
    };

    const result = await deleteTool.execute(params);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("session_expired");
    }
  });

  // Business rule: Delete is idempotent (deleting non-existent context succeeds - no error).
  // UX: User can safely retry delete without error; backend handles "already deleted" gracefully.
  it("DC3: Idempotent delete - deleting non-existent context succeeds", async () => {
    const params: DeleteContextParams = {
      sessionId: testSessionId,
      contextId: "ctx_01933ec5-c5f0-7a57-af82-87199be6cccc",
    };

    const result = await deleteTool.execute(params);

    expect(result.ok).toBe(true);
  });
});
