import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";

export default defineConfig(() => {
  return {
    esbuild: {
      target: "node18",
    },
    test: {
      testTimeout: 30000,
      hookTimeout: 30000,
      environment: "node",

      // Projects run SEQUENTIALLY (avoid data race between projects)
      sequence: {
        concurrent: false, // Projects use different datasets, must not run in parallel
      },

      // Projects для разных типов тестов с разной изоляцией
      projects: [
        {
          test: {
            name: "unit",
            include: ["tests/unit/**/*.spec.ts"],
            pool: "threads",
            poolOptions: {
              threads: {
                isolate: false,
              },
            },
            testTimeout: 10000,
          },
        },
        // ===== GDS Projection Tests (lifecycle: create/drop) =====
        {
          test: {
            name: "gds-projection-tests",
            include: ["tests/integration/gds/services/projection.test.ts"],
            pool: "threads",
            poolOptions: {
              threads: {
                isolate: true,
                singleThread: true, // Sequential (modifies projection state)
              },
            },
            // NO setupFiles - test manages its own projections
            testTimeout: 30000,
            env: loadEnv("test", process.cwd(), ""),
          },
        },
        // ===== GDS Similarity Tests (read-only algorithms) =====
        {
          test: {
            name: "gds-similarity-tests",
            include: ["tests/integration/gds/services/similarity.test.ts"],
            pool: "threads",
            poolOptions: {
              threads: {
                isolate: true,
                singleThread: false, // Parallel (read-only, shared projection)
              },
            },
            setupFiles: ["./tests/integration/gds/setup.ts"], // Load U1-U7 + create projection once
            testTimeout: 120000,
            env: loadEnv("test", process.cwd(), ""),
          },
        },
        // ===== Reason-Based Tests (dynamic user creation) =====
        {
          test: {
            name: "reason-tests",
            include: ["tests/integration/reason-based/**/*.test.ts"],
            pool: "threads",
            poolOptions: {
              threads: {
                isolate: true, // Изоляция глобального состояния
                singleThread: true, // Shared driver within project
              },
            },
            setupFiles: ["./tests/integration/reason-based/setup.ts"], // Import Reasons once
            testTimeout: 45000, // Больше времени для БД операций
            env: loadEnv("test", process.cwd(), ""),
          },
        },
        // {
        //   test: {
        //     name: "functional",
        //     include: ["tests/functional/**/*.test.ts"],
        //     pool: "threads", // Используем threads для единой БД, но с изоляцией
        //     poolOptions: {
        //       threads: {
        //         isolate: true, // Изоляция глобального состояния
        //         singleThread: true, // Отключаем параллельное выполнение тестов
        //       },
        //     },
        //     // setupFiles: ["./tests/helpers/database-setup.ts"],
        //     testTimeout: 60000, // Максимальное время для e2e сценариев
        //     env: loadEnv("test", process.cwd(), ""),
        //   },
        // },
      ],
    },
  };
});
