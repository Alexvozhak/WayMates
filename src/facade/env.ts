import { z } from "zod";

/**
 * Environment configuration schema for Facade MCP Server.
 * All variables are required. No defaults to ensure explicit configuration.
 *
 * Note: env vars use UPPER_SNAKE_CASE by convention, hence the eslint-disable.
 */
/* eslint-disable @typescript-eslint/naming-convention */
const envSchema = z.object({
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
  // Google Gemini API key for LangChain
  GOOGLE_API_KEY: z.string().min(1, "GOOGLE_API_KEY is required for LangChain agents"),
  // LangChain model configuration
  LANGCHAIN_MODEL_NAME: z.string().default("models/gemini-2.0-flash"),
  LANGCHAIN_TEMP_EXTRACTION: z.coerce.number().min(0).max(1).default(0.2),
  LANGCHAIN_TEMP_INTENT: z.coerce.number().min(0).max(1).default(0.1),
  LANGCHAIN_TEMP_AGENT: z.coerce.number().min(0).max(1).default(0.3),
  LANGCHAIN_MAX_CLARIFICATION_ROUNDS: z.coerce.number().int().positive().default(3),
});
/* eslint-enable @typescript-eslint/naming-convention */

export type FacadeEnv = z.infer<typeof envSchema>;

export function loadEnv(): FacadeEnv {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.errors
      .map((err) => `  - ${err.path.join(".")}: ${err.message}`)
      .join("\n");

    throw new Error(
      `❌ Invalid environment configuration for Facade:\n${errors}\n\n` +
        `Please ensure all required environment variables are set.`,
    );
  }

  return result.data;
}

// Export singleton config for easy access
export const config = loadEnv();
