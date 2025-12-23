import { Redis } from "ioredis";
import pino from "pino";

import { CoreClient } from "../../../src/facade/core-client.js";
import { CheckpointService } from "../../../src/facade/services/checkpoint.service.js";
import { DictionaryCache } from "../../../src/facade/services/dictionaries-cache.js";
import { DictionariesService } from "../../../src/facade/services/dictionaries.service.js";
import { DocumentaryService } from "../../../src/facade/services/documentary.service.js";
import { Normalizer } from "../../../src/facade/services/normalizer.js";
import { PostgresService } from "../../../src/facade/services/postgres.service.js";
import { SessionService } from "../../../src/facade/services/session.service.js";
import { UserService } from "../../../src/facade/services/user.service.js";

import { getTestEnv } from "./test-env.js";
import { createMockFuzzyModel } from "./llm-mock.js";

import type { GraphDeps } from "../../../src/facade/langGraph/shared/types.js";

const testLogger = pino({ level: "silent" });

export class FacadeTestContext {
  private static instance: FacadeTestContext | null = null;

  static async initialize(): Promise<FacadeTestContext> {
    if (FacadeTestContext.instance) {
      return FacadeTestContext.instance;
    }

    const testEnv = getTestEnv();

    const poolConfig = {
      host: testEnv.POSTGRES_HOST,
      port: testEnv.POSTGRES_PORT,
      user: testEnv.POSTGRES_USER,
      password: testEnv.POSTGRES_PASSWORD,
      database: testEnv.POSTGRES_DB,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 2000,
    };

    console.log("[Facade Setup] Creating PostgreSQL service...");
    const postgres = await PostgresService.create(poolConfig);

    console.log("[Facade Setup] Creating checkpoint service...");
    const checkpointService = await CheckpointService.create(postgres.getPool());

    console.log("[Facade Setup] Creating user service...");
    const userService = new UserService(postgres);

    console.log("[Facade Setup] Creating base clients...");
    const coreClient = new CoreClient(testEnv.CORE_API_URL);

    console.log("[Facade Setup] Creating Redis singleton...");
    const redis = new Redis({
      host: testEnv.REDIS_HOST,
      port: testEnv.REDIS_PORT,
    });

    console.log("[Facade Setup] Creating cache and normalizer singletons...");
    const dictionaryCache = new DictionaryCache(redis, coreClient);
    const dictionariesService = new DictionariesService(dictionaryCache);
    const mockFuzzyModel = createMockFuzzyModel();
    const normalizer = new Normalizer(dictionaryCache, coreClient, mockFuzzyModel);

    console.log("[Facade Setup] Creating session service...");
    const sessionService = new SessionService(redis);

    console.log("[Facade Setup] Creating documentary service...");
    const documentary = new DocumentaryService("./docs/presentation");

    FacadeTestContext.instance = new FacadeTestContext(
      coreClient,
      redis,
      dictionariesService,
      normalizer,
      postgres,
      checkpointService,
      userService,
      sessionService,
      documentary,
    );

    return FacadeTestContext.instance;
  }

  static getInstance(): FacadeTestContext {
    if (!FacadeTestContext.instance) {
      throw new Error("FacadeTestContext not initialized. Call initialize() in beforeAll.");
    }
    return FacadeTestContext.instance;
  }

  public readonly coreClient: CoreClient;
  public readonly redis: Redis;
  public readonly dictionariesService: DictionariesService;
  public readonly normalizerService: Normalizer;
  public readonly postgres: PostgresService;
  public readonly checkpointService: CheckpointService;
  public readonly userService: UserService;
  public readonly sessionService: SessionService;
  public readonly documentaryService: DocumentaryService;
  public readonly logger = testLogger;

  private constructor(
    coreClient: CoreClient,
    redis: Redis,
    dictionariesService: DictionariesService,
    normalizerService: Normalizer,
    postgres: PostgresService,
    checkpointService: CheckpointService,
    userService: UserService,
    sessionService: SessionService,
    documentaryService: DocumentaryService,
  ) {
    this.coreClient = coreClient;
    this.redis = redis;
    this.dictionariesService = dictionariesService;
    this.normalizerService = normalizerService;
    this.postgres = postgres;
    this.checkpointService = checkpointService;
    this.userService = userService;
    this.sessionService = sessionService;
    this.documentaryService = documentaryService;
  }

  getGraphDeps(): GraphDeps {
    return {
      coreClient: this.coreClient,
      normalizerService: this.normalizerService,
      dictionariesService: this.dictionariesService,
      checkpointService: this.checkpointService,
      logger: this.logger,
    };
  }

  async cleanup(): Promise<void> {
    await this.redis.quit();
    await this.postgres.close();
    FacadeTestContext.instance = null;
  }
}
