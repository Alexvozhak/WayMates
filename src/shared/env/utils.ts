import type { z } from "zod";

export type EnvSchema = z.ZodObject<z.ZodRawShape>;

export function createEnvLoader<T extends EnvSchema>(schema: T, serviceName: string): () => z.infer<T> {
  return () => {
    const result = schema.safeParse(process.env);

    if (!result.success) {
      const errors = result.error.errors.map((e) => `  - ${e.path.join(".")}: ${e.message}`).join("\n");

      throw new Error(`[${serviceName}] Invalid environment configuration:\n${errors}`);
    }

    return result.data;
  };
}
