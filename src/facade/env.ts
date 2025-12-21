import { z } from "zod";

import { baseEnvSchema, createEnvLoader } from "../shared/env/index.js";

const envSchema = baseEnvSchema.extend({
  REDIS_HOST: z.string().min(1, "REDIS_HOST is required"),
  REDIS_PORT: z.coerce.number().int().positive("REDIS_PORT must be a positive integer"),
  CORE_API_URL: z.string().url("CORE_API_URL must be a valid URL"),
  DICT_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(86_400),
  // PostgreSQL configuration
  POSTGRES_HOST: z.string().min(1, "POSTGRES_HOST is required"),
  POSTGRES_PORT: z.coerce.number().int().positive("POSTGRES_PORT must be a positive integer"),
  POSTGRES_USER: z.string().min(1, "POSTGRES_USER is required"),
  POSTGRES_PASSWORD: z.string().min(1, "POSTGRES_PASSWORD is required"),
  POSTGRES_DB: z.string().min(1, "POSTGRES_DB is required"),
  POSTGRES_POOL_MAX: z.coerce.number().int().positive().default(20),
  // LLM configuration (OpenRouter-compatible, auto-picked by ChatOpenAI)
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required (use OpenRouter key)"),
  OPENAI_API_BASE: z.string().url().default("https://openrouter.ai/api/v1"),
  LANGCHAIN_MODEL_NAME: z.string().default("openai/gpt-4o-mini"),
  LANGCHAIN_TEMP_DETERMINISTIC: z.coerce.number().min(0).max(1).default(0),
  LANGCHAIN_TEMP_EXTRACTION: z.coerce.number().min(0).max(1).default(0.2),
  LANGCHAIN_TEMP_PLANNING: z.coerce.number().min(0).max(1).default(0.1),
  LANGCHAIN_TEMP_AGENT: z.coerce.number().min(0).max(1).default(0.3),
  LANGCHAIN_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),
  LANGCHAIN_MAX_CLARIFICATION_ROUNDS: z.coerce.number().int().positive().default(3),
  LANGCHAIN_MAX_QUESTIONS_PER_BATCH: z.coerce.number().int().positive().default(5),
  // Rate limiting
  OPENAI_FACADE_RPM_LIMIT: z.coerce.number().int().positive().default(500),
  OPENAI_FACADE_MAX_CONCURRENT: z.coerce.number().int().positive().default(10),
  // Auth configuration
  AUTH_SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(3600),
  // Server transport configuration
  FACADE_TRANSPORT: z.enum(["stdio", "http"]).default("stdio"),
  FACADE_HTTP_PORT: z.coerce.number().int().positive().default(3000),
  // CV parser configuration
  CV_PARSER_MODEL: z.string().default("google/gemini-2.5-flash"),
  CV_PARSER_MAX_FILE_SIZE_MB: z.coerce.number().int().positive().default(10),
  CV_PARSER_MAX_OUTPUT_TOKENS: z.coerce.number().int().positive().default(4000),
  CV_PARSER_TEMPERATURE: z.coerce.number().min(0).max(1).default(0.1),
  // Documentary MCP configuration
  DOCS_PATH: z.string().default("./docs/presentation"),
  // Cloudflare R2 Configuration (optional - chart service can be disabled)
  R2_ACCOUNT_ID: z.string().min(1).optional(),
  R2_ACCESS_KEY_ID: z.string().min(1).optional(),
  R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  R2_BUCKET_NAME: z.string().min(1).optional(),
  R2_PUBLIC_URL: z.string().url().optional(),
  R2_TTL_DAYS: z.coerce.number().int().positive().default(30),
});

export type FacadeEnv = z.infer<typeof envSchema>;

export const loadEnv = createEnvLoader(envSchema, "facade");

export const config = loadEnv();
