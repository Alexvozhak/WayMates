import { z } from "zod";

const testEnvSchema = z.object({
  FACADE_MCP_URL: z.string().url().default("http://localhost:3001/mcp"),

  REDIS_HOST: z.string().default("localhost"),
  REDIS_PORT: z.coerce.number().int().positive().default(6380),

  CORE_API_URL: z.string().url().default("http://localhost:9000"),

  POSTGRES_HOST: z.string().default("localhost"),
  POSTGRES_PORT: z.coerce.number().int().positive().default(5433),
  POSTGRES_USER: z.string().default("postgres"),
  POSTGRES_PASSWORD: z.string().default("testpassword123"),
  POSTGRES_DB: z.string().default("waymates_facade_test"),
});

export type TelegramTestEnv = z.infer<typeof testEnvSchema>;

let cachedTestEnv: TelegramTestEnv | null = null;

export function getTestEnv(): TelegramTestEnv {
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
