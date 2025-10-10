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
                singleThread: true, // Отключаем параллельное выполнение тестов
              },
            },
            setupFiles: ["./tests/helpers/database-setup.ts"],
            testTimeout: 45000, // Больше времени для БД операций
            env: loadEnv("test", process.cwd(), ""),
          },
        },
        {
          test: {
            name: "functional",
            include: ["tests/functional/**/*.test.ts"],
            pool: "threads", // Используем threads для единой БД, но с изоляцией
            poolOptions: {
              threads: {
                isolate: true, // Изоляция глобального состояния
                singleThread: true, // Отключаем параллельное выполнение тестов
              },
            },
            setupFiles: ["./tests/helpers/database-setup.ts"],
            testTimeout: 60000, // Максимальное время для e2e сценариев
            env: loadEnv("test", process.cwd(), ""),
          },
        },
      ],
    },
  };
});
