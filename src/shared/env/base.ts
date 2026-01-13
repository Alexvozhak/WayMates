import { z } from "zod";

export const logLevelSchema = z.enum(["debug", "info", "warn", "error"]).default("info");

export const nodeEnvSchema = z.enum(["development", "production", "test"]).default("development");

export const baseEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema,
  LOG_LEVEL: logLevelSchema,
  SENTRY_DSN: z.string().url().nullable().default(null),
});

export type LogLevel = z.infer<typeof logLevelSchema>;
export type NodeEnv = z.infer<typeof nodeEnvSchema>;
