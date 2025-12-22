import { describe, it, expect, beforeAll, afterEach } from "vitest";

import { AuthService } from "../../../../src/facade/services/auth.service.js";
import { AuthTool } from "../../../../src/facade/mcp-server/tools/auth.tool.js";
import { SessionService } from "../../../../src/facade/services/session.service.js";
import { sessionIdSchema } from "../../../../src/shared/schemas.js";
import { FacadeTestContext } from "../../helpers/test-context.js";

import type { SessionId } from "../../../../src/facade/mcp-server/result.js";
import type { RegisterResult } from "../../../../src/facade/services/auth.service.js";

function isValidSessionId(value: unknown): boolean {
  return sessionIdSchema.safeParse(value).success;
}

function isRegisterResult(value: unknown): value is RegisterResult {
  return typeof value === "object" && value !== null && "token" in value && "sessionId" in value && "warning" in value;
}

describe("Auth Tool Integration Tests", () => {
  let ctx: FacadeTestContext;
  let sessionMiddleware: SessionService;
  let authService: AuthService;
  let authTool: AuthTool;
  const createdUserIds: string[] = [];
  const createdSessionIds: SessionId[] = [];

  beforeAll(() => {
    ctx = FacadeTestContext.getInstance();
    sessionMiddleware = new SessionService(ctx.redis);
    authService = new AuthService(sessionMiddleware, ctx.userService);
    authTool = new AuthTool(authService);
  });

  afterEach(async () => {
    for (const userId of createdUserIds) {
      await ctx.userService.delete(userId);
    }

    for (const sessionId of createdSessionIds) {
      await ctx.redis.del(`session:${sessionId}`, `thread:${sessionId}`);
    }

    createdUserIds.length = 0;
    createdSessionIds.length = 0;
  });

  it("AUTH-1: Register returns token + sessionId + warning and creates DB record", async () => {
    const result = await authTool.execute({ token: null });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(isRegisterResult(result.value)).toBe(true);
    if (!isRegisterResult(result.value)) return;

    expect(result.value.token).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(isValidSessionId(result.value.sessionId)).toBe(true);
    expect(result.value.warning).toContain("Save this token");

    createdSessionIds.push(result.value.sessionId);

    // Verify session is valid (proves DB record was created)
    const userId = await sessionMiddleware.validate(result.value.sessionId);
    expect(userId).toMatch(/^usr_[0-9a-f-]+$/);
    createdUserIds.push(userId);
  });

  it("AUTH-2: Authenticate with valid token returns sessionId", async () => {
    const registerResult = await authTool.execute({ token: null });
    expect(registerResult.ok).toBe(true);
    if (!registerResult.ok) return;
    if (!isRegisterResult(registerResult.value)) return;

    const { token, sessionId: firstSessionId } = registerResult.value;
    createdSessionIds.push(firstSessionId);

    const userId = await sessionMiddleware.validate(firstSessionId);
    createdUserIds.push(userId);

    const authResult = await authTool.execute({ token });

    expect(authResult.ok).toBe(true);
    if (!authResult.ok) return;

    expect(authResult.value).toHaveProperty("sessionId");
    expect(authResult.value).not.toHaveProperty("token");
    expect(authResult.value).not.toHaveProperty("warning");

    if ("sessionId" in authResult.value) {
      expect(isValidSessionId(authResult.value.sessionId)).toBe(true);
      createdSessionIds.push(authResult.value.sessionId);
    }
  });

  it("AUTH-3: Single Active Session - new auth revokes previous session", async () => {
    const registerResult = await authTool.execute({ token: null });
    expect(registerResult.ok).toBe(true);
    if (!registerResult.ok) return;
    if (!isRegisterResult(registerResult.value)) return;

    const { token, sessionId: firstSessionId } = registerResult.value;
    createdSessionIds.push(firstSessionId);

    const firstSessionExists = await ctx.redis.exists(`session:${firstSessionId}`);
    expect(firstSessionExists).toBe(1);

    const userId = await sessionMiddleware.validate(firstSessionId);
    createdUserIds.push(userId);

    const pointerKeyBefore = await ctx.redis.get(`user:currentSession:${userId}`);
    expect(pointerKeyBefore).toBe(firstSessionId);

    const authResult = await authTool.execute({ token });
    expect(authResult.ok).toBe(true);
    if (!authResult.ok) return;

    if ("sessionId" in authResult.value) {
      createdSessionIds.push(authResult.value.sessionId);

      const firstSessionAfterAuth = await ctx.redis.exists(`session:${firstSessionId}`);
      expect(firstSessionAfterAuth).toBe(0);

      const secondSessionExists = await ctx.redis.exists(`session:${authResult.value.sessionId}`);
      expect(secondSessionExists).toBe(1);

      const pointerKeyAfter = await ctx.redis.get(`user:currentSession:${userId}`);
      expect(pointerKeyAfter).toBe(authResult.value.sessionId);
    }
  });

  it("AUTH-4: Invalid token returns error code invalid_token", async () => {
    const fakeToken = "00000000-0000-7000-8000-000000000000";

    const result = await authTool.execute({ token: fakeToken });

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.code).toBe("invalid_token");
    expect(result.error.message).toContain("Invalid or unknown token");
  });

  it("AUTH-5: Session created by auth is valid for other tools", async () => {
    const registerResult = await authTool.execute({ token: null });
    expect(registerResult.ok).toBe(true);
    if (!registerResult.ok) return;
    if (!isRegisterResult(registerResult.value)) return;

    const { sessionId } = registerResult.value;
    createdSessionIds.push(sessionId);

    const userId = await sessionMiddleware.validate(sessionId);
    createdUserIds.push(userId);

    expect(userId).toMatch(/^usr_[0-9a-f-]+$/);
  });

  it("AUTH-6: authenticate() works multiple times with same token", async () => {
    const registerResult = await authTool.execute({ token: null });
    expect(registerResult.ok).toBe(true);
    if (!registerResult.ok) return;
    if (!isRegisterResult(registerResult.value)) return;

    const { token, sessionId: firstSessionId } = registerResult.value;
    createdSessionIds.push(firstSessionId);

    const userId = await sessionMiddleware.validate(firstSessionId);
    createdUserIds.push(userId);

    // Wait and re-authenticate
    await new Promise((resolve) => setTimeout(resolve, 100));

    const authResult = await authTool.execute({ token });
    expect(authResult.ok).toBe(true);
    if (!authResult.ok) return;

    if ("sessionId" in authResult.value) {
      createdSessionIds.push(authResult.value.sessionId);

      // Verify new session is valid
      const userIdAfterAuth = await sessionMiddleware.validate(authResult.value.sessionId);
      expect(userIdAfterAuth).toBe(userId);
    }
  });
});
