import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";

export default defineConfig(() => {
  return {
    esbuild: {
      target: "node18",
    },
    test: {
      // Global setup loads base data (U1-U18) ONCE before all projects.
      // Read-only projects use this data without setupFiles.
      // Write projects (goals, story-manager) have isolated setupFiles.
      globalSetup: './vitest.globalSetup.ts',

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
        // SearchManager integration tests (read-only, parallel)
        {
          test: {
            name: "integration-search-read-only",
            include: [
              "tests/integration/search-manager/adhoc-context-without-dtw.integration.ts",
              "tests/integration/search-manager/target-search.integration.ts",
              "tests/integration/search-manager/current-context-without-dtw.integration.ts",
              "tests/integration/search-manager/current-context-with-dtw.integration.ts"
            ],
            pool: "threads",
            poolOptions: {
              threads: {
                isolate: false,      // Shared state (U1-U18 from globalSetup)
                singleThread: false, // Parallel execution ✅
              },
            },
            // No setupFiles - uses data from globalSetup
            testTimeout: 30000,
          },
        },
        // SearchManager Goals integration tests (write, sequential)
        {
          test: {
            name: "integration-search-goals",
            include: ["tests/integration/search-manager/goals-integration.integration.ts"],
            pool: "threads",
            poolOptions: {
              threads: {
                isolate: true,
                singleThread: true,  // Sequential execution ⚠️
              },
            },
            setupFiles: ["./tests/integration/search-manager/setup-goals.ts"],
            testTimeout: 30000,
          },
        },
        // StoryManager integration tests (write, sequential)
        {
          test: {
            name: "integration-story-manager",
            include: ["tests/integration/story-manager/story-manager.integration.ts"],
            pool: "threads",
            poolOptions: {
              threads: {
                isolate: true,
                singleThread: true,  // Sequential execution ⚠️
              },
            },
            setupFiles: ["./tests/integration/story-manager/setup.ts"],
            testTimeout: 30000,
            hookTimeout: 30000,
            env: loadEnv("test", process.cwd(), ""),
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
