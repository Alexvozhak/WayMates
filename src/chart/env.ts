import { z } from "zod";

import { baseEnvSchema, createEnvLoader } from "../shared/env/index.js";

/**
 * Chart module environment schema.
 * Contains only R2 configuration needed for chart upload.
 */
const chartEnvSchema = baseEnvSchema.extend({
  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET_NAME: z.string().min(1),
  R2_PUBLIC_URL: z.string().url(),
  R2_TTL_DAYS: z.coerce.number().int().positive(),
});

export const loadChartEnv = createEnvLoader(chartEnvSchema, "chart");

export const chartConfig = loadChartEnv();
