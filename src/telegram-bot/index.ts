import { run } from "@grammyjs/runner";

import { initSentry } from "../shared/sentry.js";

import { createBot } from "./bot.js";
import { config } from "./env.js";
import { logger } from "./logger-instance.js";
import { SystemMessagePresenter } from "./presenters/system-message-presenter.js";
import { McpClient } from "./services/mcp-client.js";
import { MessageBatcherService } from "./services/message-batcher.service.js";
import { SessionService } from "./services/session-service.js";

import type { ConverseResponse } from "../../private/schemas.js";

initSentry({ dsn: config.SENTRY_DSN, environment: config.NODE_ENV, service: "telegram" });

let mcpClient: McpClient;
try {
  mcpClient = await McpClient.create(config.FACADE_MCP_URL);
  logger.info("MCP client connected");
} catch (error) {
  logger.fatal({ err: error }, "Failed to connect to MCP server");
  // eslint-disable-next-line unicorn/no-process-exit
  process.exit(1);
}

const sessionService = new SessionService(mcpClient);
const messageBatcher = new MessageBatcherService<ConverseResponse>(
  config.MESSAGE_BATCH_DELAY_MS,
  config.MESSAGE_BATCH_MAX_SIZE,
);

const llmConfig = {
  model: config.FORMATTER_LLM_MODEL,
  temperature: config.FORMATTER_LLM_TEMPERATURE,
};

const systemMessagePresenter = new SystemMessagePresenter(
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
    messageBatcher,
    systemMessagePresenter,
    openaiApiKey: config.OPENAI_API_KEY,
    openaiApiBase: config.OPENAI_API_BASE,
    groqApiKey: config.GROQ_API_KEY,
    botToken: config.TELEGRAM_BOT_TOKEN,
    feedbackChatId: config.FEEDBACK_CHAT_ID,
    logger,
  },
  config,
  logger,
);

logger.info("Starting bot with concurrent runner...");
const runner = run(bot);

const shutdown = async (signal: string): Promise<void> => {
  logger.info({ signal }, "Shutting down gracefully");
  if (runner.isRunning()) {
    await runner.stop();
  }
  await mcpClient.close();
  logger.info("Shutdown complete");
};

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));
