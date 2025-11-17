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
