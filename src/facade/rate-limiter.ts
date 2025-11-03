import type { Redis } from 'ioredis';

export class RateLimiter {
  constructor(
    private redis: Redis,
    private limitPerHour: number = 100
  ) {}

  async checkLimit(userId: string, endpoint: string): Promise<boolean> {
    const key = `rate:${userId}:${endpoint}`;
    const count = await this.redis.incr(key);

    if (count === 1) {
      await this.redis.expire(key, 3600);
    }

    return count <= this.limitPerHour;
  }

  async incrementCounter(userId: string, endpoint: string): Promise<void> {
    const key = `rate:${userId}:${endpoint}`;
    await this.redis.incr(key);
  }
}
