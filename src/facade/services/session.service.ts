import { v7 as uuidv7 } from "uuid";

import { userIdSchema } from "../../../private/schemas.js";
import { config } from "../env.js";
import { SessionExpiredError } from "../errors.js";
import { sessionIdSchema } from "../mcp-server/result.js";

import type { UserId } from "../../../private/schemas.js";
import type { SessionId } from "../mcp-server/result.js";
import type { Redis } from "ioredis";

/**
 * Session management service.
 *
 * Architecture:
 * - Single Redis key per session: session:sess_xxx → userId
 * - New session created on every register_telegram call
 * - LangGraph checkpoints are tied to userId, not sessionId
 * - Session = short-lived auth token for request validation
 */
export class SessionService {
  private static readonly sessionKeyPrefix = "session:";

  private readonly ttl = config.AUTH_SESSION_TTL_SECONDS;

  constructor(private readonly redis: Redis) {}

  async create(userId: UserId): Promise<SessionId> {
    const sessionId = this.generateSessionId();
    const sessionKey = this.getSessionKey(sessionId);

    await this.redis.setex(sessionKey, this.ttl, userId);

    return sessionId;
  }

  async validate(sessionId: SessionId): Promise<UserId> {
    const sessionKey = this.getSessionKey(sessionId);
    const userId = await this.redis.get(sessionKey);

    if (!userId) {
      throw new SessionExpiredError(`Session ${sessionId} not found or expired`);
    }

    const userIdParsed = userIdSchema.parse(userId);
    await this.redis.expire(sessionKey, this.ttl);

    return userIdParsed;
  }

  private getSessionKey(sessionId: SessionId): string {
    return `${SessionService.sessionKeyPrefix}${sessionId}`;
  }

  private generateSessionId(): SessionId {
    return sessionIdSchema.parse(`sess_${uuidv7()}`);
  }
}
