import { z } from "zod";

export const envSchema = z.object({
  // Core
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  FACADE_MCP_URL: z.string().url().default("http://localhost:3000/mcp"),
  FACADE_REQUEST_TIMEOUT_MS: z.coerce.number().min(1000).max(60_000).default(30_000),
  OPENAI_API_KEY: z.string().min(1),
  GROQ_API_KEY: z.string().min(1),
  NODE_ENV: z.enum(["development", "production"]).default("development"),
  // LLM Formatter configuration
  FORMATTER_LLM_MODEL: z.string().default("gpt-4o-mini"),
  FORMATTER_LLM_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.7),
});

export type BotEnv = z.infer<typeof envSchema>;

export function validateEnv(): BotEnv {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.errors.map((error) => `${error.path.join(".")}: ${error.message}`).join("\n");

    throw new Error(`Environment validation failed:\n${errors}`);
  }

  return result.data;
}
