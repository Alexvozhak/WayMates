import { z } from "zod";

const testEnvSchema = z.object({
  // Redis test instance
  REDIS_HOST: z.string().default("localhost"),
  REDIS_PORT: z.coerce.number().int().positive().default(6380),

  // Core API for integration tests
  CORE_API_URL: z.string().url().default("http://localhost:9000"),

  // PostgreSQL test database
  POSTGRES_HOST: z.string().default("localhost"),
  POSTGRES_PORT: z.coerce.number().int().positive().default(5433),
  POSTGRES_USER: z.string().default("postgres"),
  POSTGRES_PASSWORD: z.string().default("testpassword123"),
  POSTGRES_DB: z.string().default("waymates_facade_test"),

  // Google Gemini for LLM tests
  GOOGLE_API_KEY: z.string().min(1, "GOOGLE_API_KEY required for LLM fuzzy matching tests"),
});

export type FacadeTestEnv = z.infer<typeof testEnvSchema>;

let cachedTestEnv: FacadeTestEnv | null = null;

export function getTestEnv(): FacadeTestEnv {
  if (cachedTestEnv) {
    return cachedTestEnv;
  }

  const result = testEnvSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.errors.map((err) => `  - ${err.path.join(".")}: ${err.message}`).join("\n");

    throw new Error(
      `❌ Invalid test environment configuration:\n${errors}\n\nCheck .env.test file and ensure all required variables are set.`,
    );
  }

  cachedTestEnv = result.data;
  return cachedTestEnv;
}
