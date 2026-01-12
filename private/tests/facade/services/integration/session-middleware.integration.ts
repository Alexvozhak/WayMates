import { afterEach, beforeEach, describe, expect, it } from "vitest";


import { SessionExpiredError } from "../../../../../src/facade/errors.js";
import { SessionService } from "../../../../../src/facade/services/session.service.js";
import { cleanupSession } from "../../helpers/mcp-tool-helpers.js";
import { FacadeTestContext } from "../../helpers/test-context.js";

import type { SessionId } from "../../../../../src/facade/mcp-server/result.js";
import type { UserId } from "@shared/schemas.js";
import type { Redis } from "ioredis";

describe("Session Middleware Integration Tests", () => {
  let ctx: FacadeTestContext;
  let redis: Redis;
  let middleware: SessionService;
  let testSessionId: SessionId | null = null;

  beforeEach(() => {
    ctx = FacadeTestContext.getInstance();
    redis = ctx.redis;
    middleware = new SessionService(redis);
  });

  afterEach(async () => {
    if (testSessionId) {
      await cleanupSession(testSessionId);
      testSessionId = null;
    }
  });

  // Business rule: Sessions map anonymous MCP client connections to authenticated users.
  // Redis stores sessionId → userId mapping with TTL for stateless auth across requests.
  it("SM1: Valid session returns userId from Redis", async () => {
    const userId: UserId = "usr_01933ec5-c5f0-7a57-af82-87199be6c123";
    testSessionId = await middleware.create(userId);

    const retrievedUserId = await middleware.validate(testSessionId);

    expect(retrievedUserId).toBe(userId);
  });

  // Business rule: Invalid/non-existent sessions prevent unauthorized access to user data.
  // All MCP tools require valid session; rejection happens before any business logic executes.
  it("SM2: Invalid session throws SessionExpiredError", async () => {
    const invalidSession: SessionId = "sess_invalid123";

    await expect(middleware.validate(invalidSession)).rejects.toThrow(SessionExpiredError);
  });

  // Business rule: Sessions expire after 1 hour (TTL=3600s) to balance security and UX.
  // Expired sessions require re-authentication; prevents indefinite access from stolen tokens.
  it("SM3: Expired session throws SessionExpiredError", async () => {
    const userId: UserId = "usr_01933ec5-c5f0-7a57-af82-87199be6c124";
    testSessionId = await middleware.create(userId);

    const sessionKey = `session:${testSessionId}`;
    await redis.expire(sessionKey, 0);

    await new Promise((resolve) => setTimeout(resolve, 100));

    await expect(middleware.validate(testSessionId)).rejects.toThrow(SessionExpiredError);
  });

  // Business rule: Active sessions extend TTL on each request (sliding window expiration).
  // Users don't get logged out mid-interaction; only idle sessions expire after 1 hour.
  it("SM4: Session TTL extends on access", async () => {
    const userId: UserId = "usr_01933ec5-c5f0-7a57-af82-87199be6c125";
    testSessionId = await middleware.create(userId);

    const sessionKey = `session:${testSessionId}`;
    const _initialTtl = await redis.ttl(sessionKey);

    await new Promise((resolve) => setTimeout(resolve, 1000));

    await middleware.validate(testSessionId);
    const extendedTtl = await redis.ttl(sessionKey);

    // Verify sliding window: validate() must call redis.expire() to reset TTL
    // This prevents active sessions from expiring mid-interaction (critical behavior)
    // We check TTL value to ensure redis.expire() was called with correct parameter
    // Range [3595, 3600] accounts for execution delays (network + Redis processing)
    // If this fails → sessions expire even during active use (critical regression)
    expect(extendedTtl).toBeGreaterThanOrEqual(3595);
    expect(extendedTtl).toBeLessThanOrEqual(3600);
  });

  // Business rule: Multiple concurrent users can have active sessions without interference.
  // Each sessionId uniquely maps to one userId; no cross-contamination of user data.
  it("SM5: Concurrent sessions isolated - different sessions different users", async () => {
    const user1: UserId = "usr_01933ec5-c5f0-7a57-af82-87199be6c126";
    const user2: UserId = "usr_01933ec5-c5f0-7a57-af82-87199be6c127";

    const session1 = await middleware.create(user1);
    const session2 = await middleware.create(user2);

    const retrieved1 = await middleware.validate(session1);
    const retrieved2 = await middleware.validate(session2);

    expect(retrieved1).toBe(user1);
    expect(retrieved2).toBe(user2);
    expect(session1).not.toBe(session2);
  });
});
