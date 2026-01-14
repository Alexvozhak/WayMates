import { z } from "zod";

import { baseEnvSchema, createEnvLoader } from "../shared/env/index.js";

export const envSchema = baseEnvSchema.extend({
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  FACADE_MCP_URL: z.string().url(),
  FACADE_REQUEST_TIMEOUT_MS: z.coerce.number().min(1000).max(60_000),
  REDIS_URL: z.string().url(),
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_API_BASE: z.string().url(),
  GROQ_API_KEY: z.string().min(1),
  // LLM Formatter configuration
  FORMATTER_LLM_MODEL: z.string().min(1),
  FORMATTER_LLM_TEMPERATURE: z.coerce.number().min(0).max(2),
  // Feedback (optional — feature frozen)
  FEEDBACK_CHAT_ID: z.string().optional(),
  // Rate limiting
  USER_RATE_LIMIT_WINDOW_MS: z.coerce.number().positive(),
  USER_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().positive(),
  TELEGRAM_PRESENTER_RPM_LIMIT: z.coerce.number().int().positive(),
  TELEGRAM_PRESENTER_MAX_CONCURRENT: z.coerce.number().int().positive(),
  // Message batching (race condition protection)
  MESSAGE_BATCH_DELAY_MS: z.coerce.number().int().positive(),
  MESSAGE_BATCH_MAX_SIZE: z.coerce.number().int().positive(),
});

export type BotEnv = z.infer<typeof envSchema>;

export const validateEnv = createEnvLoader(envSchema, "telegram-bot");

export const config = validateEnv();
