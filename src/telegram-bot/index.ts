import OpenAI from "openai";

import { createBot } from "./bot.js";
import { validateEnv } from "./env.js";
import { logger } from "./logger.js";

const env = validateEnv();
const openaiClient = new OpenAI({ apiKey: env.OPENAI_API_KEY });

const bot = createBot(env.TELEGRAM_BOT_TOKEN, {
  facadeMcpUrl: env.FACADE_MCP_URL,
  openaiApiKey: env.OPENAI_API_KEY,
  openaiClient,
  botToken: env.TELEGRAM_BOT_TOKEN,
  formatterLlm: {
    model: env.FORMATTER_LLM_MODEL,
    temperature: env.FORMATTER_LLM_TEMPERATURE,
  },
});

process.on("SIGTERM", () => void bot.stop());
process.on("SIGINT", () => void bot.stop());

logger.info("Starting bot...");
await bot.start();
