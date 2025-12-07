import { Redis } from "ioredis";

import { CoreClient } from "./core-client.js";
import { config } from "./env.js";
import { createMcpServer } from "./mcp-server/mcp-server.js";
import { AuthService } from "./services/auth.service.js";
import { CheckpointService } from "./services/checkpoint.service.js";
import { DictionariesCache } from "./services/dictionaries-cache.js";
import { Normalizer } from "./services/normalizer.js";
import { PostgresService } from "./services/postgres.service.js";
import { SessionService } from "./services/session.service.js";
import { UserService } from "./services/user.service.js";

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
    max: 20,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 2000,
  };

  const postgresService = await PostgresService.create(poolConfig);
  const checkpointService = await CheckpointService.create(postgresService.getPool());

  const userService = new UserService(postgresService);

  const coreClient = new CoreClient(config.CORE_API_URL);
  const sessionMiddleware = new SessionService(redis);
  const authService = new AuthService(sessionMiddleware, userService);

  const cache = new DictionariesCache(redis, coreClient);
  const normalizer = new Normalizer(cache, coreClient);

  const server = createMcpServer({
    sessionMiddleware,
    normalizer,
    coreClient,
    checkpointService,
    userService,
    authService,
  });

  await server.start({
    transportType: "stdio",
  });
}

await main();
