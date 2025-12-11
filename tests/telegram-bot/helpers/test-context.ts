import { Redis } from "ioredis";

import { CoreClient } from "../../../src/facade/core-client.js";
import { McpClient } from "../../../src/telegram-bot/services/mcp-client.js";

import { getTestEnv } from "./test-env.js";

import type { TelegramTestEnv } from "./test-env.js";

export class TelegramTestContext {
  private static instance: TelegramTestContext | null = null;

  static async initialize(): Promise<TelegramTestContext> {
    if (TelegramTestContext.instance) {
      return TelegramTestContext.instance;
    }

    const env = getTestEnv();

    console.log("[Telegram Setup] Creating MCP client...");
    const mcpClient = await McpClient.create(env.FACADE_MCP_URL);

    console.log("[Telegram Setup] Creating Core client for fixture loading...");
    const coreClient = new CoreClient(env.CORE_API_URL);

    console.log("[Telegram Setup] Creating Redis client...");
    const redis = new Redis({
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
    });

    TelegramTestContext.instance = new TelegramTestContext(mcpClient, coreClient, redis, env);

    return TelegramTestContext.instance;
  }

  static getInstance(): TelegramTestContext {
    if (!TelegramTestContext.instance) {
      throw new Error("TelegramTestContext not initialized. Call initialize() in beforeAll.");
    }
    return TelegramTestContext.instance;
  }

  public readonly mcpClient: McpClient;
  public readonly coreClient: CoreClient;
  public readonly redis: Redis;
  public readonly env: TelegramTestEnv;

  private constructor(mcpClient: McpClient, coreClient: CoreClient, redis: Redis, env: TelegramTestEnv) {
    this.mcpClient = mcpClient;
    this.coreClient = coreClient;
    this.redis = redis;
    this.env = env;
  }

  async cleanup(): Promise<void> {
    await this.mcpClient.close();
    await this.redis.quit();
    TelegramTestContext.instance = null;
  }
}
