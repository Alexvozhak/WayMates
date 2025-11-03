import { defineConfig } from "vitest/config";

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
        // DISABLED: Old GDS tests (to be refactored)
        // {
        //   test: {
        //     name: "gds-projection-tests",
        //     include: ["tests/integration/gds/services/projection.test.ts"],
        //     pool: "threads",
        //     poolOptions: {
        //       threads: {
        //         isolate: true,
        //         singleThread: true,
        //       },
        //     },
        //     testTimeout: 30000,
        //     env: loadEnv("test", process.cwd(), ""),
        //   },
        // },
        // {
        //   test: {
        //     name: "gds-similarity-tests",
        //     include: ["tests/integration/gds/services/similarity.test.ts"],
        //     pool: "threads",
        //     poolOptions: {
        //       threads: {
        //         isolate: true,
        //         singleThread: false,
        //       },
        //     },
        //     setupFiles: ["./tests/integration/gds/setup.ts"],
        //     testTimeout: 120000,
        //     env: loadEnv("test", process.cwd(), ""),
        //   },
        // },
        // {
        //   test: {
        //     name: "reason-tests",
        //     include: ["tests/integration/reason-based/**/*.test.ts"],
        //     pool: "threads",
        //     poolOptions: {
        //       threads: {
        //         isolate: true,
        //         singleThread: true,
        //       },
        //     },
        //     setupFiles: ["./tests/integration/reason-based/setup.ts"],
        //     testTimeout: 45000,
        //     env: loadEnv("test", process.cwd(), ""),
        //   },
        // },
        // {
        //   test: {
        //     name: "gds-pathfinding-tests",
        //     include: [
        //       "tests/integration/gds/services/pathfinding.test.ts",
        //       "tests/integration/gds/services/reason-analytics.test.ts"
        //     ],
        //     pool: "threads",
        //     poolOptions: {
        //       threads: {
        //         isolate: true,
        //         singleThread: false,
        //       },
        //     },
        //     setupFiles: ["./tests/integration/gds/setup-pathfinding.ts"],
        //     testTimeout: 60000,
        //     env: loadEnv("test", process.cwd(), ""),
        //   },
        // },
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
