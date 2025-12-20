import { Pool } from "pg";
import { Redis } from "ioredis";

import { CoreClient } from "../../../src/facade/core-client.js";
import { CheckpointService } from "../../../src/facade/services/checkpoint.service.js";
import { SessionService } from "../../../src/facade/services/session.service.js";
import { McpClient } from "../../../src/telegram-bot/services/mcp-client.js";

import { getTestEnv } from "./test-env.js";

import type { SessionId, UserId } from "../../../src/shared/schemas.js";
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

    console.log("[Telegram Setup] Creating PostgreSQL pool for checkpoints...");
    const pgPool = new Pool({
      host: env.POSTGRES_HOST,
      port: env.POSTGRES_PORT,
      user: env.POSTGRES_USER,
      password: env.POSTGRES_PASSWORD,
      database: env.POSTGRES_DB,
    });

    console.log("[Telegram Setup] Creating checkpoint service...");
    const checkpointService = await CheckpointService.create(pgPool);

    console.log("[Telegram Setup] Creating session service...");
    const sessionService = new SessionService(redis);

    TelegramTestContext.instance = new TelegramTestContext(
      mcpClient,
      coreClient,
      redis,
      checkpointService,
      sessionService,
      env,
    );

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
  public readonly checkpointService: CheckpointService;
  public readonly sessionService: SessionService;
  public readonly env: TelegramTestEnv;

  private constructor(
    mcpClient: McpClient,
    coreClient: CoreClient,
    redis: Redis,
    checkpointService: CheckpointService,
    sessionService: SessionService,
    env: TelegramTestEnv,
  ) {
    this.mcpClient = mcpClient;
    this.coreClient = coreClient;
    this.redis = redis;
    this.checkpointService = checkpointService;
    this.sessionService = sessionService;
    this.env = env;
  }

  async createSessionForUser(userId: UserId): Promise<SessionId> {
    return this.sessionService.create(userId);
  }

  async cleanup(): Promise<void> {
    await this.mcpClient.close();
    await this.redis.quit();
    TelegramTestContext.instance = null;
  }
}
