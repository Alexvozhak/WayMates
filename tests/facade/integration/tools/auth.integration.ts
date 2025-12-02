import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import pg from "pg";

import { AuthService } from "../../../../src/facade/mcp-server/auth.service.js";
import { AuthTool } from "../../../../src/facade/mcp-server/tools/auth.tool.js";
import { SessionMiddleware } from "../../../../src/facade/mcp-server/session-middleware.js";
import { FacadeTestContext } from "../../helpers/test-context.js";
import { getTestEnv } from "../../helpers/test-env.js";

import type { SessionId } from "../../../../src/facade/mcp-server/result.js";
import type { RegisterResult } from "../../../../src/facade/mcp-server/auth.service.js";

function isRegisterResult(value: unknown): value is RegisterResult {
  return typeof value === "object" && value !== null && "token" in value && "sessionId" in value && "warning" in value;
}

describe("Auth Tool Integration Tests", () => {
  let ctx: FacadeTestContext;
  let pool: pg.Pool;
  let sessionMiddleware: SessionMiddleware;
  let authService: AuthService;
  let authTool: AuthTool;
  const createdUserIds: string[] = [];
  const createdSessionIds: SessionId[] = [];

  beforeAll(async () => {
    ctx = FacadeTestContext.getInstance();

    const testEnv = getTestEnv();
    pool = new pg.Pool({
      host: testEnv.POSTGRES_HOST,
      port: testEnv.POSTGRES_PORT,
      user: testEnv.POSTGRES_USER,
      password: testEnv.POSTGRES_PASSWORD,
      database: testEnv.POSTGRES_DATABASE,
    });

    await pool.query(`
      CREATE TABLE IF NOT EXISTS facade.users (
        user_id TEXT PRIMARY KEY,
        token TEXT UNIQUE NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_auth_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    sessionMiddleware = new SessionMiddleware(ctx.redis);
    authService = new AuthService(sessionMiddleware);
    authTool = new AuthTool(authService);
  });

  afterAll(async () => {
    await pool.end();
  });

  afterEach(async () => {
    for (const userId of createdUserIds) {
      await pool.query("DELETE FROM facade.users WHERE user_id = $1", [userId]);
    }

    for (const sessionId of createdSessionIds) {
      await ctx.redis.del(`session:${sessionId}`, `thread:${sessionId}`);
    }

    createdUserIds.length = 0;
    createdSessionIds.length = 0;
  });

  async function trackCreatedUser(token: string): Promise<void> {
    const userResult = await pool.query<{ user_id: string }>("SELECT user_id FROM facade.users WHERE token = $1", [
      token,
    ]);
    const row = userResult.rows[0];
    if (row) {
      createdUserIds.push(row.user_id);
    }
  }

  it("AUTH-1: Register returns token + sessionId + warning and creates DB record", async () => {
    const result = await authTool.execute({});

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(isRegisterResult(result.value)).toBe(true);
    if (!isRegisterResult(result.value)) return;

    expect(result.value.token).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(result.value.sessionId).toMatch(/^sess_[0-9a-f]{32}$/);
    expect(result.value.warning).toContain("Save this token");

    createdSessionIds.push(result.value.sessionId);

    const dbUser = await pool.query<{ user_id: string; token: string }>(
      "SELECT user_id, token FROM facade.users WHERE token = $1",
      [result.value.token],
    );
    expect(dbUser.rows.length).toBe(1);
    const userRow = dbUser.rows[0];
    expect(userRow).toBeDefined();
    if (userRow) {
      expect(userRow.user_id).toMatch(/^usr_[0-9a-f-]+$/);
      expect(userRow.token).toBe(result.value.token);
      createdUserIds.push(userRow.user_id);
    }
  });

  it("AUTH-2: Authenticate with valid token returns sessionId", async () => {
    const registerResult = await authTool.execute({});
    expect(registerResult.ok).toBe(true);
    if (!registerResult.ok) return;
    if (!isRegisterResult(registerResult.value)) return;

    const { token, sessionId: firstSessionId } = registerResult.value;
    createdSessionIds.push(firstSessionId);
    await trackCreatedUser(token);

    const authResult = await authTool.execute({ token });

    expect(authResult.ok).toBe(true);
    if (!authResult.ok) return;

    expect(authResult.value).toHaveProperty("sessionId");
    expect(authResult.value).not.toHaveProperty("token");
    expect(authResult.value).not.toHaveProperty("warning");

    if ("sessionId" in authResult.value) {
      expect(authResult.value.sessionId).toMatch(/^sess_[0-9a-f]{32}$/);
      createdSessionIds.push(authResult.value.sessionId);
    }
  });

  it("AUTH-3: Single Active Session - new auth revokes previous session", async () => {
    const registerResult = await authTool.execute({});
    expect(registerResult.ok).toBe(true);
    if (!registerResult.ok) return;
    if (!isRegisterResult(registerResult.value)) return;

    const { token, sessionId: firstSessionId } = registerResult.value;
    createdSessionIds.push(firstSessionId);
    await trackCreatedUser(token);

    const firstSessionExists = await ctx.redis.exists(`session:${firstSessionId}`);
    expect(firstSessionExists).toBe(1);

    const userId = await sessionMiddleware.validate(firstSessionId);
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
    const registerResult = await authTool.execute({});
    expect(registerResult.ok).toBe(true);
    if (!registerResult.ok) return;
    if (!isRegisterResult(registerResult.value)) return;

    const { token, sessionId } = registerResult.value;
    createdSessionIds.push(sessionId);
    await trackCreatedUser(token);

    const userId = await sessionMiddleware.validate(sessionId);

    expect(userId).toMatch(/^usr_[0-9a-f-]+$/);
  });

  it("AUTH-6: authenticate() updates last_auth_at timestamp", async () => {
    const registerResult = await authTool.execute({});
    expect(registerResult.ok).toBe(true);
    if (!registerResult.ok) return;
    if (!isRegisterResult(registerResult.value)) return;

    const { token, sessionId: firstSessionId } = registerResult.value;
    createdSessionIds.push(firstSessionId);

    const userResult = await pool.query<{ user_id: string; last_auth_at: Date }>(
      "SELECT user_id, last_auth_at FROM facade.users WHERE token = $1",
      [token],
    );
    expect(userResult.rows.length).toBe(1);
    const row = userResult.rows[0];
    if (!row) return;

    createdUserIds.push(row.user_id);
    const firstAuthAt = row.last_auth_at;

    await new Promise((resolve) => setTimeout(resolve, 100));

    const authResult = await authTool.execute({ token });
    expect(authResult.ok).toBe(true);
    if (!authResult.ok) return;

    if ("sessionId" in authResult.value) {
      createdSessionIds.push(authResult.value.sessionId);
    }

    const updatedResult = await pool.query<{ last_auth_at: Date }>(
      "SELECT last_auth_at FROM facade.users WHERE token = $1",
      [token],
    );
    const updatedRow = updatedResult.rows[0];
    expect(updatedRow).toBeDefined();
    if (!updatedRow) return;

    expect(updatedRow.last_auth_at.getTime()).toBeGreaterThan(firstAuthAt.getTime());
  });
});
