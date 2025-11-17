import { Redis } from "ioredis";

import { CoreTRPCClient } from "./core-client/core-trpc-client.js";
import { loadEnv } from "./env.js";
import { createFacadeServer } from "./mcp-server/facade-mcp-server.js";
import { SessionMiddleware } from "./mcp-server/session-middleware.js";
import { SimpleNormalizer } from "./mcp-server/simple-normalizer.js";

async function main(): Promise<void> {
  const env = loadEnv();

  const redis = new Redis({
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
  });

  const sessionMiddleware = new SessionMiddleware(redis);
  const normalizer = new SimpleNormalizer();
  const coreClient = new CoreTRPCClient(env.CORE_API_URL);

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
