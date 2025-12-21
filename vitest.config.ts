import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";

// Test timeout constants
const UNIT_TEST_TIMEOUT = 10_000; // 10s for unit tests
const INTEGRATION_TEST_TIMEOUT = 30_000; // 30s for integration tests
const INTEGRATION_HOOK_TIMEOUT = 30_000; // 30s for setup/teardown hooks

export default defineConfig(() => {
  return {
    esbuild: {
      target: "node20",
    },
    test: {
      testTimeout: INTEGRATION_TEST_TIMEOUT,
      hookTimeout: INTEGRATION_HOOK_TIMEOUT,
      environment: "node",
      reporters: ["verbose"],
      coverage: {
        provider: "v8" as const,
        reporter: ["text", "html"],
        reportsDirectory: "./coverage",
        include: ["src/facade/**/*.ts", "src/shared/**/*.ts"],
        exclude: ["**/*.d.ts", "**/*.spec.ts", "**/index.ts"],
      },

      // Projects run SEQUENTIALLY to avoid data race
      sequence: {
        concurrent: false,
      },

      projects: [
        {
          test: {
            name: "unit",
            include: [
              "tests/core/unit/**/*.spec.ts",
              "tests/facade/agents/**/unit/**/*.spec.ts",
              "tests/facade/tools/**/*.spec.ts",
            ],
            pool: "threads",
            poolOptions: {
              threads: {
                isolate: false,
              },
            },
            testTimeout: UNIT_TEST_TIMEOUT,
            // Unit tests don't use globalSetup (no database needed)
            // But facade unit tests need env vars for config imports
            env: loadEnv("test", process.cwd(), ""),
          },
        },
        // Telegram Bot unit tests with LLM (nlp-parser needs longer timeout)
        {
          test: {
            name: "telegram-unit",
            include: ["tests/telegram-bot/unit/**/*.spec.ts"],
            pool: "threads",
            poolOptions: {
              threads: {
                isolate: false,
                singleThread: true, // Sequential to avoid rate limit issues
              },
            },
            testTimeout: 30_000, // 30s for LLM calls
            env: loadEnv("test", process.cwd(), ""),
          },
        },
        // Facade unit tests with LLM (no infrastructure, longer timeout)
        {
          test: {
            name: "facade-unit-llm",
            include: ["tests/facade/services/unit/**/*.spec.ts"],
            pool: "threads",
            poolOptions: {
              threads: {
                isolate: false,
                singleThread: true, // Sequential to avoid rate limit issues
              },
            },
            testTimeout: 30_000, // 30s for LLM calls
            env: loadEnv("test", process.cwd(), ""),
          },
        },
        // Read-only search tests (parallel execution, shared globalSetup data)
        {
          test: {
            name: "integration-search-read-only",
            include: [
              "tests/core/integration/search-manager/adhoc-context-without-dtw.integration.ts",
              "tests/core/integration/search-manager/target-search.integration.ts",
              "tests/core/integration/search-manager/current-context-without-dtw.integration.ts",
              "tests/core/integration/search-manager/current-context-with-dtw.integration.ts",
            ],
            pool: "threads",
            poolOptions: {
              threads: {
                isolate: false, // Shared state from globalSetup
                singleThread: false, // Parallel execution
              },
            },
            setupFiles: ["./tests/core/helpers/drivers/shared-driver.ts"],
            globalSetup: "./vitest.globalSetup.ts",
            testTimeout: INTEGRATION_TEST_TIMEOUT,
          },
        },
        // Goals CRUD tests (sequential, isolated data reload per test)
        {
          test: {
            name: "integration-goals",
            include: ["tests/core/integration/goals-manager/goals-integration.integration.ts"],
            pool: "threads",
            poolOptions: {
              threads: {
                isolate: true,
                singleThread: true, // Write operations require sequential execution
              },
            },
            setupFiles: ["./tests/core/helpers/drivers/goals-driver.ts"],
            globalSetup: "./vitest.globalSetup.ts",
            testTimeout: INTEGRATION_TEST_TIMEOUT,
          },
        },
        // Dictionaries tests (sequential, write operations)
        {
          test: {
            name: "integration-dictionaries",
            include: ["tests/core/integration/dictionaries-manager/dictionaries.integration.ts"],
            pool: "threads",
            poolOptions: {
              threads: {
                isolate: true,
                singleThread: true,
              },
            },
            globalSetup: "./vitest.globalSetup.ts",
            testTimeout: INTEGRATION_TEST_TIMEOUT,
            env: loadEnv("test", process.cwd(), ""),
          },
        },
        // User router tests (sequential, write operations)
        {
          test: {
            name: "integration-user-router",
            include: ["tests/core/integration/user-router/*.integration.ts"],
            pool: "threads",
            poolOptions: {
              threads: {
                isolate: true,
                singleThread: true,
              },
            },
            globalSetup: "./vitest.globalSetup.ts",
            testTimeout: INTEGRATION_TEST_TIMEOUT,
            env: loadEnv("test", process.cwd(), ""),
          },
        },
        // Story persistence tests (sequential, runs LAST to avoid cleanup conflicts)
        {
          test: {
            name: "integration-story-manager",
            include: ["tests/core/integration/story-manager/story-manager.integration.ts"],
            pool: "threads",
            poolOptions: {
              threads: {
                isolate: true,
                singleThread: true, // Write operations require sequential execution
              },
            },
            setupFiles: ["./tests/core/helpers/drivers/story-manager-driver.ts"],
            globalSetup: "./vitest.globalSetup.ts",
            testTimeout: INTEGRATION_TEST_TIMEOUT,
            hookTimeout: INTEGRATION_HOOK_TIMEOUT,
            env: loadEnv("test", process.cwd(), ""),
          },
        },
        // Facade integration tests (sequential, Redis + LLM state conflicts)
        {
          test: {
            name: "facade-integration",
            include: [
              "tests/facade/agents/**/integration/**/*.integration.ts",
              "tests/facade/mcp-tools/**/*.integration.ts",
              "tests/facade/services/**/*.integration.ts",
            ],
            pool: "threads",
            poolOptions: {
              threads: {
                isolate: false, // Shared state from setupFiles (CoreClient, LLMMatcher)
                singleThread: true, // Redis + LLM state requires sequential execution
              },
            },
            setupFiles: ["./tests/facade/helpers/test-setup.ts"],
            testTimeout: 180_000, // 3min for LLM-heavy tests (cold-start agent)
            hookTimeout: 60_000, // 1min for fixture loading (U1-U9 via tRPC)
            env: loadEnv("test", process.cwd(), ""),
          },
        },
        // Telegram Bot integration tests (MCP Client → Facade MCP Server)
        {
          test: {
            name: "telegram-integration",
            include: ["tests/telegram-bot/**/*.integration.ts"],
            pool: "threads",
            poolOptions: {
              threads: {
                isolate: false,
                singleThread: true, // Sequential to avoid MCP session conflicts
              },
            },
            setupFiles: ["./tests/telegram-bot/helpers/test-setup.ts"],
            testTimeout: 60_000, // 1min for MCP round-trips
            hookTimeout: 30_000,
            env: loadEnv("test", process.cwd(), ""),
          },
        },
      ],
    },
  };
});
