import { SessionMiddleware } from "../../../src/facade/mcp-server/session-middleware.js";

import { FacadeTestContext } from "./test-context.js";

import type { SessionId } from "../../../src/facade/mcp-server/result.js";
import type { UserId } from "../../../src/shared/schemas.js";

export async function setupSession(userId: UserId): Promise<[SessionMiddleware, SessionId]> {
  const ctx = FacadeTestContext.getInstance();
  const session = new SessionMiddleware(ctx.redis);
  const sessionId = await session.create(userId);

  return [session, sessionId];
}

export async function cleanupSession(sessionId: SessionId): Promise<void> {
  const ctx = FacadeTestContext.getInstance();
  const sessionKey = `session:${sessionId}`;
  const threadKey = `thread:${sessionId}`;

  await ctx.redis.del(sessionKey, threadKey);
}
