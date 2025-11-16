import { SessionExpiredError } from './tools/base-tool.js';

import type { SessionId } from '../shared/result.js';
import type { UserId } from '../shared/schemas.js';
import type { Redis } from 'ioredis';


export class SessionMiddleware {
  private static readonly sessionTtlSeconds = 3600;
  private static readonly sessionKeyPrefix = 'session:';

  constructor(private redis: Redis) {}

  async validate(sessionId: SessionId): Promise<UserId> {
    const key = this.getSessionKey(sessionId);
    const userId = await this.redis.get(key);

    if (!userId) {
      throw new SessionExpiredError(
        `Session ${sessionId} not found or expired`
      );
    }

    await this.redis.expire(key, SessionMiddleware.sessionTtlSeconds);

    return userId as UserId;
  }

  async create(userId: UserId): Promise<SessionId> {
    const sessionId = this.generateSessionId();
    const key = this.getSessionKey(sessionId);

    await this.redis.setex(
      key,
      SessionMiddleware.sessionTtlSeconds,
      userId
    );

    return sessionId;
  }

  async revoke(sessionId: SessionId): Promise<void> {
    const key = this.getSessionKey(sessionId);
    await this.redis.del(key);
  }

  private getSessionKey(sessionId: SessionId): string {
    return `${SessionMiddleware.sessionKeyPrefix}${sessionId}`;
  }

  private generateSessionId(): SessionId {
    const randomHex = Array.from({ length: 32 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('');

    return `sess_${randomHex}` as SessionId;
  }
}
