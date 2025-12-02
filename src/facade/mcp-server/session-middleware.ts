import { randomBytes } from "node:crypto";

import { userIdSchema } from "../../shared/schemas.js";
import { config } from "../env.js";
import { SessionExpiredError } from "../errors.js";

import { sessionIdSchema } from "./result.js";

import type { SessionId } from "./result.js";
import type { UserId } from "../../shared/schemas.js";
import type { Redis } from "ioredis";

export class SessionMiddleware {
  private static readonly sessionKeyPrefix = "session:";
  private static readonly threadKeyPrefix = "thread:";
  private static readonly currentSessionKeyPrefix = "user:currentSession:";

  constructor(private redis: Redis) {}

  async validate(sessionId: SessionId): Promise<UserId> {
    const sessionKey = this.getSessionKey(sessionId);
    const userId = await this.redis.get(sessionKey);

    if (!userId) {
      throw new SessionExpiredError(`Session ${sessionId} not found or expired`);
    }

    const userIdParsed = userIdSchema.parse(userId);
    const pointerKey = this.getCurrentSessionKey(userIdParsed);
    const threadKey = this.getThreadKey(sessionId);
    const ttl = config.AUTH_SESSION_TTL_SECONDS;

    await this.redis.pipeline().expire(sessionKey, ttl).expire(pointerKey, ttl).expire(threadKey, ttl).exec();

    return userIdParsed;
  }

  async create(userId: UserId): Promise<SessionId> {
    const sessionId = this.generateSessionId();
    const key = this.getSessionKey(sessionId);

    await this.redis.setex(key, config.AUTH_SESSION_TTL_SECONDS, userId);

    return sessionId;
  }

  async revoke(sessionId: SessionId): Promise<void> {
    const key = this.getSessionKey(sessionId);
    const threadKey = this.getThreadKey(sessionId);
    await this.redis.del(key, threadKey);
  }

  async getThreadId(sessionId: SessionId): Promise<string> {
    const threadKey = this.getThreadKey(sessionId);
    let threadId = await this.redis.get(threadKey);

    if (!threadId) {
      threadId = `thread_${randomBytes(16).toString("hex")}`;
      await this.redis.setex(threadKey, config.AUTH_SESSION_TTL_SECONDS, threadId);
    }

    return threadId;
  }

  async createWithSingleActiveSession(userId: UserId): Promise<SessionId> {
    const sessionId = this.generateSessionId();
    const pointerKey = this.getCurrentSessionKey(userId);
    const sessionKey = this.getSessionKey(sessionId);
    const threadKey = this.getThreadKey(sessionId);
    const ttl = config.AUTH_SESSION_TTL_SECONDS;

    const script = `
      local pointerKey = KEYS[1]
      local sessionKey = KEYS[2]
      local threadKey = KEYS[3]
      local ttl = ARGV[1]
      local userId = ARGV[2]
      local sessionId = ARGV[3]

      local oldSession = redis.call('GET', pointerKey)
      if oldSession then
        redis.call('DEL', 'session:' .. oldSession)
        redis.call('DEL', 'thread:' .. oldSession)
      end

      redis.call('SETEX', sessionKey, ttl, userId)
      redis.call('SETEX', pointerKey, ttl, sessionId)

      return sessionId
    `;

    await this.redis.eval(script, 3, pointerKey, sessionKey, threadKey, ttl, userId, sessionId);

    return sessionId;
  }

  async revokeAllUserSessions(userId: UserId): Promise<void> {
    const pointerKey = this.getCurrentSessionKey(userId);
    const existingSessionId = await this.redis.get(pointerKey);

    if (existingSessionId) {
      const parsed = sessionIdSchema.safeParse(existingSessionId);
      if (parsed.success) {
        await this.revoke(parsed.data);
      }
      await this.redis.del(pointerKey);
    }
  }

  private getSessionKey(sessionId: SessionId): string {
    return `${SessionMiddleware.sessionKeyPrefix}${sessionId}`;
  }

  private getThreadKey(sessionId: SessionId): string {
    return `${SessionMiddleware.threadKeyPrefix}${sessionId}`;
  }

  private getCurrentSessionKey(userId: UserId): string {
    return `${SessionMiddleware.currentSessionKeyPrefix}${userId}`;
  }

  private generateSessionId(): SessionId {
    const randomHex = randomBytes(16).toString("hex");
    return sessionIdSchema.parse(`sess_${randomHex}`);
  }
}
