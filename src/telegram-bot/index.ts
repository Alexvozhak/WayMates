import { Redis } from "ioredis";

import { createBot } from "./bot.js";
import { validateEnv } from "./env.js";
import { createLogger } from "./logger.js";
import { CrudGraphPresenter } from "./presenters/crud-graph-presenter.js";
import { SearchGraphPresenter } from "./presenters/search-graph-presenter.js";
import { SystemMessagePresenter } from "./presenters/system-message-presenter.js";
import { WelcomePresenter } from "./presenters/welcome-presenter.js";
import { McpClient } from "./services/mcp-client.js";
import { SessionService } from "./services/session-service.js";

const env = validateEnv();

const logger = createLogger(env.NODE_ENV, process.env.LOG_LEVEL);

const redis = new Redis(env.REDIS_URL);

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
  mcpClient = await McpClient.create(env.FACADE_MCP_URL);
  logger.info("MCP client connected");
} catch (error) {
  logger.fatal({ err: error }, "Failed to connect to MCP server");
  await redis.quit();
  // eslint-disable-next-line unicorn/no-process-exit
  process.exit(1);
}

const sessionService = new SessionService(mcpClient, redis);

const llmConfig = {
  model: env.FORMATTER_LLM_MODEL,
  temperature: env.FORMATTER_LLM_TEMPERATURE,
};

const searchGraphPresenter = new SearchGraphPresenter(
  env.OPENAI_API_KEY,
  llmConfig,
  env.TELEGRAM_PRESENTER_RPM_LIMIT,
  env.TELEGRAM_PRESENTER_MAX_CONCURRENT,
  logger,
  env.OPENAI_API_BASE,
);

const crudGraphPresenter = new CrudGraphPresenter(
  env.OPENAI_API_KEY,
  llmConfig,
  env.TELEGRAM_PRESENTER_RPM_LIMIT,
  env.TELEGRAM_PRESENTER_MAX_CONCURRENT,
  logger,
  env.OPENAI_API_BASE,
);

const systemMessagePresenter = new SystemMessagePresenter(
  env.OPENAI_API_KEY,
  llmConfig,
  env.TELEGRAM_PRESENTER_RPM_LIMIT,
  env.TELEGRAM_PRESENTER_MAX_CONCURRENT,
  logger,
  env.OPENAI_API_BASE,
);

const welcomePresenter = new WelcomePresenter(
  env.OPENAI_API_KEY,
  llmConfig,
  env.TELEGRAM_PRESENTER_RPM_LIMIT,
  env.TELEGRAM_PRESENTER_MAX_CONCURRENT,
  logger,
  env.OPENAI_API_BASE,
);

const bot = createBot(
  env.TELEGRAM_BOT_TOKEN,
  {
    mcpClient,
    sessionService,
    searchGraphPresenter,
    crudGraphPresenter,
    systemMessagePresenter,
    welcomePresenter,
    openaiApiKey: env.OPENAI_API_KEY,
    openaiApiBase: env.OPENAI_API_BASE,
    groqApiKey: env.GROQ_API_KEY,
    botToken: env.TELEGRAM_BOT_TOKEN,
    feedbackChatId: env.FEEDBACK_CHAT_ID,
    logger,
  },
  redis,
  env,
  logger,
);

logger.info("Starting bot...");
await bot.start();
