import { Redis } from "ioredis";

import { createBot } from "./bot.js";
import { validateEnv } from "./env.js";
import { logger } from "./logger.js";
import { GoalPresenter } from "./presenters/goal-presenter.js";
import { LangGraphPresenter } from "./presenters/langgraph-presenter.js";
import { SearchGraphPresenter } from "./presenters/search-graph-presenter.js";
import { SearchPresenter } from "./presenters/search-presenter.js";
import { StoryPresenter } from "./presenters/story-presenter.js";
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
const searchPresenter = new SearchPresenter(
  env.OPENAI_API_KEY,
  llmConfig,
  env.TELEGRAM_PRESENTER_RPM_LIMIT,
  env.TELEGRAM_PRESENTER_MAX_CONCURRENT,
  env.OPENAI_API_BASE,
);
const searchGraphPresenter = new SearchGraphPresenter(
  env.OPENAI_API_KEY,
  llmConfig,
  env.TELEGRAM_PRESENTER_RPM_LIMIT,
  env.TELEGRAM_PRESENTER_MAX_CONCURRENT,
  env.OPENAI_API_BASE,
);
const langGraphPresenter = new LangGraphPresenter(
  env.OPENAI_API_KEY,
  llmConfig,
  env.TELEGRAM_PRESENTER_RPM_LIMIT,
  env.TELEGRAM_PRESENTER_MAX_CONCURRENT,
  env.OPENAI_API_BASE,
);
const storyPresenter = new StoryPresenter(
  env.OPENAI_API_KEY,
  llmConfig,
  env.TELEGRAM_PRESENTER_RPM_LIMIT,
  env.TELEGRAM_PRESENTER_MAX_CONCURRENT,
  env.OPENAI_API_BASE,
);
const goalPresenter = new GoalPresenter(
  env.OPENAI_API_KEY,
  llmConfig,
  env.TELEGRAM_PRESENTER_RPM_LIMIT,
  env.TELEGRAM_PRESENTER_MAX_CONCURRENT,
  env.OPENAI_API_BASE,
);
const welcomePresenter = new WelcomePresenter(
  env.OPENAI_API_KEY,
  llmConfig,
  env.TELEGRAM_PRESENTER_RPM_LIMIT,
  env.TELEGRAM_PRESENTER_MAX_CONCURRENT,
  env.OPENAI_API_BASE,
);

const bot = createBot(
  env.TELEGRAM_BOT_TOKEN,
  {
    mcpClient,
    sessionService,
    searchGraphPresenter,
    langGraphPresenter,
    welcomePresenter,
    openaiApiKey: env.OPENAI_API_KEY,
    openaiApiBase: env.OPENAI_API_BASE,
    groqApiKey: env.GROQ_API_KEY,
    botToken: env.TELEGRAM_BOT_TOKEN,
    feedbackChatId: env.FEEDBACK_CHAT_ID,
    // DEPRECATED: Remove in Phase 4
    searchPresenter,
    storyPresenter,
    goalPresenter,
  },
  redis,
  env,
);

logger.info("Starting bot...");
await bot.start();
