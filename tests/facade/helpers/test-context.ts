import { Redis } from "ioredis";

import { CoreTRPCClient } from "../../../src/facade/core-client/core-trpc-client.js";
import { DictionariesCache } from "../../../src/facade/services/dictionaries-cache.js";
import { FacadeNormalizer } from "../../../src/facade/services/facade-normalizer.js";
import { LLMFuzzyMatcher } from "../../../src/facade/services/llm-fuzzy-matcher.js";

import { getTestEnv } from "./test-env.js";
import { createMockLLMFuzzyMatcher } from "./llm-mock.js";

export class FacadeTestContext {
  private static instance: FacadeTestContext | null = null;

  static initialize(): FacadeTestContext {
    if (FacadeTestContext.instance) {
      return FacadeTestContext.instance;
    }

    const testEnv = getTestEnv();

    console.log("[Facade Setup] Creating base clients...");
    const coreClient = new CoreTRPCClient(testEnv.CORE_API_URL);

    const llmMatcherMock = createMockLLMFuzzyMatcher();
    const llmMatcherReal = new LLMFuzzyMatcher(testEnv.GOOGLE_API_KEY);

    console.log("[Facade Setup] Creating Redis singleton...");
    const redis = new Redis({
      host: testEnv.REDIS_HOST,
      port: testEnv.REDIS_PORT,
    });

    console.log("[Facade Setup] Creating cache and normalizer singletons...");
    const cache = new DictionariesCache(redis, coreClient);
    const normalizer = new FacadeNormalizer(cache, coreClient, llmMatcherMock);

    FacadeTestContext.instance = new FacadeTestContext(
      coreClient,
      llmMatcherMock,
      llmMatcherReal,
      redis,
      cache,
      normalizer,
    );

    return FacadeTestContext.instance;
  }

  static getInstance(): FacadeTestContext {
    if (!FacadeTestContext.instance) {
      throw new Error("FacadeTestContext not initialized. Call initialize() in beforeAll.");
    }
    return FacadeTestContext.instance;
  }

  public readonly coreClient: CoreTRPCClient;
  public readonly llmMatcherMock: LLMFuzzyMatcher;
  public readonly llmMatcherReal: LLMFuzzyMatcher;
  public readonly redis: Redis;
  public readonly cache: DictionariesCache;
  public readonly normalizer: FacadeNormalizer;

  private constructor(
    coreClient: CoreTRPCClient,
    llmMatcherMock: LLMFuzzyMatcher,
    llmMatcherReal: LLMFuzzyMatcher,
    redis: Redis,
    cache: DictionariesCache,
    normalizer: FacadeNormalizer,
  ) {
    this.coreClient = coreClient;
    this.llmMatcherMock = llmMatcherMock;
    this.llmMatcherReal = llmMatcherReal;
    this.redis = redis;
    this.cache = cache;
    this.normalizer = normalizer;
  }

  async cleanup(): Promise<void> {
    await this.redis.quit();
    FacadeTestContext.instance = null;
  }
}
