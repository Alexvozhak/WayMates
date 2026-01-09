import { z } from "zod";

import { baseEnvSchema, createEnvLoader } from "../shared/env/index.js";

const envSchema = baseEnvSchema.extend({
  NEO4J_URI: z.string().min(1, "NEO4J_URI is required"),
  NEO4J_USER: z.string().min(1, "NEO4J_USER is required"),
  NEO4J_PASSWORD: z.string().min(1, "NEO4J_PASSWORD is required"),
  NEO4J_MAX_POOL_SIZE: z.coerce.number().int().positive().default(50),
  CORE_PORT: z.coerce.number().int().positive().default(9000),
  CORE_HOST: z.string().default("0.0.0.0"),
});

export const loadEnv = createEnvLoader(envSchema, "core");

export const config = loadEnv();
