import { randomBytes } from "node:crypto";

import { userIdSchema } from "../../shared/schemas.js";

import { sessionIdSchema } from "./result.js";
import { SessionExpiredError } from "./tools/errors.js";

import type { SessionId } from "./result.js";
import type { UserId } from "../../shared/schemas.js";
import type { Redis } from "ioredis";

export class SessionMiddleware {
  private static readonly sessionTtlSeconds = 3600;
  private static readonly sessionKeyPrefix = "session:";
  private static readonly threadKeyPrefix = "thread:";

  constructor(private redis: Redis) {}

  async validate(sessionId: SessionId): Promise<UserId> {
    const key = this.getSessionKey(sessionId);
    const userId = await this.redis.get(key);

    if (!userId) {
      throw new SessionExpiredError(`Session ${sessionId} not found or expired`);
    }

    await this.redis.expire(key, SessionMiddleware.sessionTtlSeconds);

    return userIdSchema.parse(userId);
  }

  async create(userId: UserId): Promise<SessionId> {
    const sessionId = this.generateSessionId();
    const key = this.getSessionKey(sessionId);

    await this.redis.setex(key, SessionMiddleware.sessionTtlSeconds, userId);

    return sessionId;
  }

  async revoke(sessionId: SessionId): Promise<void> {
    const key = this.getSessionKey(sessionId);
    const threadKey = this.getThreadKey(sessionId);
    await this.redis.del(key, threadKey);
  }

  /**
   * Get or create thread_id for LangGraph checkpointing
   * Each session has one thread_id that persists across the session lifetime
   */
  async getThreadId(sessionId: SessionId): Promise<string> {
    const threadKey = this.getThreadKey(sessionId);
    let threadId = await this.redis.get(threadKey);

    if (!threadId) {
      // Generate new thread_id for this session
      threadId = `thread_${randomBytes(16).toString("hex")}`;
      await this.redis.setex(threadKey, SessionMiddleware.sessionTtlSeconds, threadId);
    }

    return threadId;
  }

  private getSessionKey(sessionId: SessionId): string {
    return `${SessionMiddleware.sessionKeyPrefix}${sessionId}`;
  }

  private getThreadKey(sessionId: SessionId): string {
    return `${SessionMiddleware.threadKeyPrefix}${sessionId}`;
  }

  private generateSessionId(): SessionId {
    const randomHex = randomBytes(16).toString("hex");
    return sessionIdSchema.parse(`sess_${randomHex}`);
  }
}
