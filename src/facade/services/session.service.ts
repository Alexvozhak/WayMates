import { v7 as uuidv7 } from "uuid";

import { userIdSchema } from "../../../private/schemas.js";
import { config } from "../env.js";
import { SessionExpiredError } from "../errors.js";
import { sessionIdSchema } from "../mcp-server/result.js";

import type { UserId } from "../../../private/schemas.js";
import type { SessionId } from "../mcp-server/result.js";
import type { Redis } from "ioredis";

export class SessionService {
  private static readonly sessionKeyPrefix = "session:";
  private static readonly pointerKeyPrefix = "user:currentSession:";

  private readonly ttl = config.AUTH_SESSION_TTL_SECONDS;

  constructor(private readonly redis: Redis) {}

  async create(userId: UserId): Promise<SessionId> {
    const sessionId = this.generateSessionId();
    const pointerKey = this.getPointerKey(userId);
    const sessionKey = this.getSessionKey(sessionId);

    const script = `
      local pointerKey = KEYS[1]
      local sessionKey = KEYS[2]
      local ttl = ARGV[1]
      local userId = ARGV[2]
      local sessionId = ARGV[3]

      local oldSession = redis.call('GET', pointerKey)
      if oldSession then
        redis.call('DEL', 'session:' .. oldSession)
      end

      redis.call('SETEX', sessionKey, ttl, userId)
      redis.call('SETEX', pointerKey, ttl, sessionId)

      return sessionId
    `;

    await this.redis.eval(script, 2, pointerKey, sessionKey, this.ttl, userId, sessionId);

    return sessionId;
  }

  async getOrCreate(userId: UserId): Promise<SessionId> {
    const pointerKey = this.getPointerKey(userId);
    const existingSessionId = await this.redis.get(pointerKey);

    if (existingSessionId) {
      const sessionId = sessionIdSchema.parse(existingSessionId);
      await this.refreshTtl(sessionId, userId);
      return sessionId;
    }

    return this.create(userId);
  }

  async validate(sessionId: SessionId): Promise<UserId> {
    const sessionKey = this.getSessionKey(sessionId);
    const userId = await this.redis.get(sessionKey);

    if (!userId) {
      throw new SessionExpiredError(`Session ${sessionId} not found or expired`);
    }

    const userIdParsed = userIdSchema.parse(userId);
    await this.refreshTtl(sessionId, userIdParsed);

    return userIdParsed;
  }

  private async refreshTtl(sessionId: SessionId, userId: UserId): Promise<void> {
    const sessionKey = this.getSessionKey(sessionId);
    const pointerKey = this.getPointerKey(userId);

    await this.redis.pipeline().expire(sessionKey, this.ttl).expire(pointerKey, this.ttl).exec();
  }

  private getSessionKey(sessionId: SessionId): string {
    return `${SessionService.sessionKeyPrefix}${sessionId}`;
  }

  private getPointerKey(userId: UserId): string {
    return `${SessionService.pointerKeyPrefix}${userId}`;
  }

  private generateSessionId(): SessionId {
    return sessionIdSchema.parse(`sess_${uuidv7()}`);
  }
}
