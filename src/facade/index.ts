import axios from 'axios';
import { Redis } from 'ioredis';

import { CoreRestClient } from './core-rest-client.js';
import { createFacadeServer } from './facade-mcp-server.js';
import { SessionMiddleware } from './session-middleware.js';
import { SimpleNormalizer } from './simple-normalizer.js';

async function main(): Promise<void> {
  const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
  });

  const coreApiUrl = process.env.CORE_API_URL || 'http://localhost:9000/api';
  const httpClient = axios.create({
    baseURL: coreApiUrl,
    timeout: 30_000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  await httpClient.get('/health', {
    baseURL: coreApiUrl.replace('/api', ''),
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
    transportType: 'stdio',
  });

  console.log('🚀 WayMates Facade MCP Server started successfully');
}

await main();
