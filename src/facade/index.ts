import { Redis } from "ioredis";

import { CoreTRPCClient } from "./core-client/core-trpc-client.js";
import { loadEnv } from "./env.js";
import { createFacadeServer } from "./mcp-server/facade-mcp-server.js";
import { SessionMiddleware } from "./mcp-server/session-middleware.js";
import { DictionariesCache } from "./services/dictionaries-cache.js";
import { FacadeNormalizer } from "./services/facade-normalizer.js";
import { LLMFuzzyMatcher } from "./services/llm-fuzzy-matcher.js";

async function main(): Promise<void> {
  const env = loadEnv();

  const redis = new Redis({
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
  });

  const coreClient = new CoreTRPCClient(env.CORE_API_URL);
  const sessionMiddleware = new SessionMiddleware(redis);

  const cache = new DictionariesCache(redis, coreClient);
  const llm = new LLMFuzzyMatcher();
  const normalizer = new FacadeNormalizer(cache, coreClient, llm);

  const server = createFacadeServer({
    sessionMiddleware,
    normalizer,
    coreClient,
  });

  await server.start({
    transportType: "stdio",
  });

  console.log("🚀 WayMates Facade MCP Server started successfully");
}

await main();
