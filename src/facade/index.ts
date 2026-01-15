import { Redis } from "ioredis";

import { initSentry } from "../shared/sentry.js";

import { CoreClient } from "./core-client.js";
import { config } from "./env.js";
import { logger } from "./logger.js";
import { createMcpServer } from "./mcp-server/mcp-server.js";
import { AuthService } from "./services/auth.service.js";
import { CheckpointService } from "./services/checkpoint.service.js";
import { DictionaryCache } from "./services/dictionaries-cache.js";
import { DictionariesService } from "./services/dictionaries.service.js";
import { DocumentaryService } from "./services/documentary.service.js";
import { Normalizer } from "./services/normalizer.js";
import { PostgresService } from "./services/postgres.service.js";
import { SessionService } from "./services/session.service.js";
import { UserService } from "./services/user.service.js";

initSentry({ dsn: config.SENTRY_DSN, environment: config.NODE_ENV, service: "facade" });

async function main(): Promise<void> {
  const redis = new Redis({
    host: config.REDIS_HOST,
    port: config.REDIS_PORT,
  });

  const poolConfig = {
    host: config.POSTGRES_HOST,
    port: config.POSTGRES_PORT,
    user: config.POSTGRES_USER,
    password: config.POSTGRES_PASSWORD,
    database: config.POSTGRES_DB,
    max: config.POSTGRES_POOL_MAX,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 2000,
  };

  const postgresService = await PostgresService.create(poolConfig);
  const checkpointService = await CheckpointService.create(postgresService.getPool());

  const userService = new UserService(postgresService);

  const coreClient = new CoreClient(config.CORE_API_URL);
  const sessionService = new SessionService(redis);
  const authService = new AuthService(sessionService, userService);

  const dictionaryCache = new DictionaryCache(redis, coreClient);
  const dictionariesService = new DictionariesService(dictionaryCache);
  const normalizerService = new Normalizer(dictionaryCache, coreClient);
  const documentaryService = new DocumentaryService(config.DOCS_PATH);

  const server = createMcpServer({
    sessionService,
    normalizerService,
    coreClient,
    dictionariesService,
    checkpointService,
    userService,
    authService,
    documentaryService,
  });

  if (config.FACADE_TRANSPORT === "http") {
    // FastMCP defaults: endpoint="/mcp", enableJsonResponse=false (SSE mode)
    await server.start({
      transportType: "httpStream",
      httpStream: {
        port: config.FACADE_HTTP_PORT,
        host: "0.0.0.0", // Required for Docker: listen on all interfaces
      },
    });
    logger.info({ port: config.FACADE_HTTP_PORT }, "WayMates Facade MCP Server (HTTP) started");
  } else {
    await server.start({
      transportType: "stdio",
    });
    logger.info("WayMates Facade MCP Server (stdio) started");
  }
}

await main();
