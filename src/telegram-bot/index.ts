import { Redis } from "ioredis";

import { initSentry } from "../shared/sentry.js";

import { createBot } from "./bot.js";
import { config } from "./env.js";
import { logger } from "./logger-instance.js";
import { CrudGraphPresenter } from "./presenters/crud-graph-presenter.js";
import { SearchGraphPresenter } from "./presenters/search-graph-presenter.js";
import { SystemMessagePresenter } from "./presenters/system-message-presenter.js";
import { WelcomePresenter } from "./presenters/welcome-presenter.js";
import { McpClient } from "./services/mcp-client.js";
import { SessionService } from "./services/session-service.js";

initSentry({ dsn: config.SENTRY_DSN, environment: config.NODE_ENV, service: "telegram" });

const redis = new Redis(config.REDIS_URL);

async function checkDependencies(): Promise<void> {
  try {
    await redis.ping();
    logger.info("Redis connected");
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
  await mcpClient.close();
  await redis.quit();
  logger.info("Shutdown complete");
  // eslint-disable-next-line unicorn/no-process-exit
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

await checkDependencies();

let mcpClient: McpClient;
try {
  mcpClient = await McpClient.create(config.FACADE_MCP_URL);
  logger.info("MCP client connected");
} catch (error) {
  logger.fatal({ err: error }, "Failed to connect to MCP server");
  await redis.quit();
  // eslint-disable-next-line unicorn/no-process-exit
  process.exit(1);
}

const sessionService = new SessionService(mcpClient, redis);

const llmConfig = {
  model: config.FORMATTER_LLM_MODEL,
  temperature: config.FORMATTER_LLM_TEMPERATURE,
};

const searchGraphPresenter = new SearchGraphPresenter(
  config.OPENAI_API_KEY,
  llmConfig,
  config.TELEGRAM_PRESENTER_RPM_LIMIT,
  config.TELEGRAM_PRESENTER_MAX_CONCURRENT,
  logger,
  config.OPENAI_API_BASE,
);

const crudGraphPresenter = new CrudGraphPresenter(
  config.OPENAI_API_KEY,
  llmConfig,
  config.TELEGRAM_PRESENTER_RPM_LIMIT,
  config.TELEGRAM_PRESENTER_MAX_CONCURRENT,
  logger,
  config.OPENAI_API_BASE,
);

const systemMessagePresenter = new SystemMessagePresenter(
  config.OPENAI_API_KEY,
  llmConfig,
  config.TELEGRAM_PRESENTER_RPM_LIMIT,
  config.TELEGRAM_PRESENTER_MAX_CONCURRENT,
  logger,
  config.OPENAI_API_BASE,
);

const welcomePresenter = new WelcomePresenter(
  config.OPENAI_API_KEY,
  llmConfig,
  config.TELEGRAM_PRESENTER_RPM_LIMIT,
  config.TELEGRAM_PRESENTER_MAX_CONCURRENT,
  logger,
  config.OPENAI_API_BASE,
);

const bot = createBot(
  config.TELEGRAM_BOT_TOKEN,
  {
    mcpClient,
    sessionService,
    searchGraphPresenter,
    crudGraphPresenter,
    systemMessagePresenter,
    welcomePresenter,
    openaiApiKey: config.OPENAI_API_KEY,
    openaiApiBase: config.OPENAI_API_BASE,
    groqApiKey: config.GROQ_API_KEY,
    botToken: config.TELEGRAM_BOT_TOKEN,
    feedbackChatId: config.FEEDBACK_CHAT_ID,
    logger,
  },
  redis,
  config,
  logger,
);

logger.info("Starting bot...");
await bot.start();
