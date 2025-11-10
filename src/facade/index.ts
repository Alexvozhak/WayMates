import axios from 'axios';
import Database from 'better-sqlite3';
import { Redis } from 'ioredis';
import { OpenAI } from 'openai';

import { AuthService } from './auth-service.js';
import { createFacadeServer } from './facade-mcp-server.js';
import { FacadeOrchestrator } from './facade-orchestrator.js';
import { LLMTranslator } from './llm-translator.js';
import { RateLimiter } from './rate-limiter.js';

async function main(): Promise<void> {
  const db = new Database('./data/facade.db');
  const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
  });
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const coreApiUrl = process.env.CORE_API_URL || 'http://localhost:9000/api';
  const coreClient = axios.create({
    baseURL: coreApiUrl,
    timeout: 30_000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  await coreClient.get('/health', {
    baseURL: coreApiUrl.replace('/api', ''),
  });

  const authService = new AuthService(db);
  const rateLimiter = new RateLimiter(redis);
  const llmTranslator = new LLMTranslator(openai);

  const orchestrator = new FacadeOrchestrator(
    authService,
    llmTranslator,
    rateLimiter,
    coreClient
  );

  const server = createFacadeServer(orchestrator);

  await server.start({
    transportType: 'stdio',
  });

  console.log('🚀 WayMates Facade MCP Server started successfully');
}

await main();
