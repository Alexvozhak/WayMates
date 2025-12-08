import { telegramRegisterParamsSchema } from "../../facade/mcp-server/schemas.js";
import { telegramRegisterResponseSchema } from "../schemas/mcp-responses.js";

import type { BotContext } from "../types.js";
import type { McpClient } from "./mcp-client.js";
import type { Redis } from "ioredis";

export class SessionService {
  constructor(
    private mcpClient: McpClient,
    private redis: Redis,
  ) {}

  async initialize(ctx: BotContext): Promise<void> {
    const telegramUserId = ctx.from?.id;
    if (!telegramUserId) {
      throw new Error("Telegram user ID not found");
    }

    const result = await this.mcpClient.callTool(
      "register_telegram",
      { telegramUserId },
      telegramRegisterParamsSchema,
      telegramRegisterResponseSchema,
    );

    ctx.session = {
      status: "initialised",
      token: result.token,
      hasStory: result.hasStory,
    };

    const cacheKey = `telegram:session:${telegramUserId}:sessionId`;
    await this.redis.setex(cacheKey, 1800, result.sessionId);
  }

  async getSessionId(ctx: BotContext): Promise<string> {
    const telegramUserId = ctx.from?.id;
    if (!telegramUserId) {
      throw new Error("Telegram user ID not found");
    }

    const cacheKey = `telegram:session:${telegramUserId}:sessionId`;
    const cachedSessionId = await this.redis.get(cacheKey);

    if (cachedSessionId) {
      return cachedSessionId;
    }

    const result = await this.mcpClient.callTool(
      "register_telegram",
      { telegramUserId },
      telegramRegisterParamsSchema,
      telegramRegisterResponseSchema,
    );

    await this.redis.setex(cacheKey, 1800, result.sessionId);

    if (ctx.session.status === "uninitialised") {
      ctx.session = {
        status: "initialised",
        token: result.token,
        hasStory: result.hasStory,
      };
    }

    return result.sessionId;
  }

  async clearSessionCache(userId: number): Promise<void> {
    const cacheKey = `telegram:session:${userId}:sessionId`;
    await this.redis.del(cacheKey);
  }

  async saveSessionId(userId: number, sessionId: string): Promise<void> {
    const cacheKey = `telegram:session:${userId}:sessionId`;
    await this.redis.setex(cacheKey, 1800, sessionId);
  }
}
