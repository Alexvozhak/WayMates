import axios from "axios";
import { Redis } from "ioredis";

import { CoreRestClient } from "./core-rest-client.js";
import { loadEnv } from "./env.js";
import { createFacadeServer } from "./facade-mcp-server.js";
import { SessionMiddleware } from "./session-middleware.js";
import { SimpleNormalizer } from "./simple-normalizer.js";

async function main(): Promise<void> {
  const env = loadEnv();

  const redis = new Redis({
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
  });

  const httpClient = axios.create({
    baseURL: env.CORE_API_URL,
    timeout: 30_000,
    headers: {
      "Content-Type": "application/json",
    },
  });

  await httpClient.get("/health", {
    baseURL: env.CORE_API_URL.replace("/api", ""),
  });

  const sessionMiddleware = new SessionMiddleware(redis);
  const normalizer = new SimpleNormalizer();
  const coreClient = new CoreRestClient(httpClient);

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
