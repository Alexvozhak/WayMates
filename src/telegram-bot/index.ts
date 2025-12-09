import axios from "axios";
import { Redis } from "ioredis";

import { createBot } from "./bot.js";
import { validateEnv } from "./env.js";
import { logger } from "./logger.js";
import { ColdStartPresenter } from "./presenters/cold-start-presenter.js";
import { SearchPresenter } from "./presenters/search-presenter.js";
import { WelcomePresenter } from "./presenters/welcome-presenter.js";
import { McpClient } from "./services/mcp-client.js";
import { SessionService } from "./services/session-service.js";

const env = validateEnv();

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
const redis = new Redis(redisUrl);

async function checkDependencies(): Promise<void> {
  try {
    await redis.ping();
    logger.info("Redis connected");

    await axios.get(`${env.FACADE_MCP_URL}/health`, { timeout: 5000 });
    logger.info("Facade MCP reachable");
  } catch (error) {
    logger.fatal({ err: error }, "Failed to connect to dependencies");
    await redis.quit();
    // eslint-disable-next-line unicorn/no-process-exit
    process.exit(1);
  }
}

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "Shutting down gracefully");
  await bot.stop();
  await redis.quit();
  logger.info("Shutdown complete");
  // eslint-disable-next-line unicorn/no-process-exit
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

await checkDependencies();

const mcpClient = new McpClient(env.FACADE_MCP_URL, env.FACADE_REQUEST_TIMEOUT_MS);
const sessionService = new SessionService(mcpClient, redis);
const searchPresenter = new SearchPresenter(env.OPENAI_API_KEY, {
  model: env.FORMATTER_LLM_MODEL,
  temperature: env.FORMATTER_LLM_TEMPERATURE,
});
const coldStartPresenter = new ColdStartPresenter(env.OPENAI_API_KEY, {
  model: env.FORMATTER_LLM_MODEL,
  temperature: env.FORMATTER_LLM_TEMPERATURE,
});
const welcomePresenter = new WelcomePresenter(env.OPENAI_API_KEY, {
  model: env.FORMATTER_LLM_MODEL,
  temperature: env.FORMATTER_LLM_TEMPERATURE,
});

const bot = createBot(
  env.TELEGRAM_BOT_TOKEN,
  {
    mcpClient,
    sessionService,
    searchPresenter,
    coldStartPresenter,
    welcomePresenter,
    openaiApiKey: env.OPENAI_API_KEY,
    groqApiKey: env.GROQ_API_KEY,
    botToken: env.TELEGRAM_BOT_TOKEN,
  },
  redis,
);

logger.info("Starting bot...");
await bot.start();
