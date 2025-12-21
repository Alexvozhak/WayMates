import { z } from "zod";

export const logLevelSchema = z.enum(["debug", "info", "warn", "error"]).default("info");

export const nodeEnvSchema = z.enum(["development", "production", "test"]).default("development");

export const baseEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema,
  LOG_LEVEL: logLevelSchema,
});

export type LogLevel = z.infer<typeof logLevelSchema>;
export type NodeEnv = z.infer<typeof nodeEnvSchema>;
export type BaseEnv = z.infer<typeof baseEnvSchema>;
