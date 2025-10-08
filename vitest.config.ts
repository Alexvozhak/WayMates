import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";

export default defineConfig(() => {
  return {
    test: {
      testTimeout: 30000,
      hookTimeout: 30000,
      environment: "node",

      // Projects для разных типов тестов с разной изоляцией
      projects: [
        {
          test: {
            name: "unit",
            include: ["tests/unit/**/*.test.ts"],
            pool: "threads",
            poolOptions: {
              threads: {
                isolate: false, // Максимальная скорость для unit тестов
              },
            },
            testTimeout: 10000, // Быстрые unit тесты
          },
        },
        {
          test: {
            name: "integration",
            include: ["tests/integration/**/*.test.ts"],
            pool: "threads",
            poolOptions: {
              threads: {
                isolate: true, // Изоляция глобального состояния для БД тестов
              },
            },
            setupFiles: ["./tests/helpers/database-setup.ts"],
            testTimeout: 45000, // Больше времени для БД операций
            env: loadEnv("integration", process.cwd(), ""),
          },
        },
        {
          test: {
            name: "functional",
            include: ["tests/functional/**/*.test.ts"],
            pool: "forks", // Полная изоляция процессов для e2e тестов
            setupFiles: ["./tests/helpers/database-setup.ts"],
            testTimeout: 60000, // Максимальное время для e2e сценариев
            env: loadEnv("functional", process.cwd(), ""),
          },
        },
      ],
    },
  };
});
