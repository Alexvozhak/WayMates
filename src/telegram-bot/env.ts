import { z } from "zod";

import { baseEnvSchema, createEnvLoader } from "../shared/env/index.js";

export const envSchema = baseEnvSchema.extend({
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  FACADE_MCP_URL: z.string().url().default("http://localhost:3000/mcp"),
  FACADE_REQUEST_TIMEOUT_MS: z.coerce.number().min(1000).max(60_000).default(30_000),
  REDIS_URL: z.string().url().default("redis://localhost:6379"),
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_API_BASE: z.string().url().optional(),
  GROQ_API_KEY: z.string().min(1),
  // LLM Formatter configuration
  FORMATTER_LLM_MODEL: z.string().default("gpt-4o-mini"),
  FORMATTER_LLM_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.7),
  // Feedback
  FEEDBACK_CHAT_ID: z.string().optional(),
  // Rate limiting
  USER_RATE_LIMIT_WINDOW_MS: z.coerce.number().positive().default(10_000),
  USER_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().positive().default(3),
  TELEGRAM_PRESENTER_RPM_LIMIT: z.coerce.number().int().positive().default(60),
  TELEGRAM_PRESENTER_MAX_CONCURRENT: z.coerce.number().int().positive().default(5),
});

export type BotEnv = z.infer<typeof envSchema>;

export const validateEnv = createEnvLoader(envSchema, "telegram-bot");

export const config = validateEnv();
