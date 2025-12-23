import { z } from "zod";

import { dictionaryEntrySchema } from "../../shared/schemas.js";
import { config } from "../env.js";

import type { DictionaryEntry, SimpleDictionaryType } from "../../shared/schemas.js";
import type { CoreClient } from "../core-client.js";
import type { Redis } from "ioredis";

/**
 * String arrays for LLM extraction prompts (KNOWN_* hints).
 * Extracted from DictionaryEntry[] for prompt injection.
 */
export type ExtractionDictionaries = {
  role: string[];
  position: string[];
  domain: string[];
  skill: string[];
  industry: string[];
};

export class DictionariesCache {
  private readonly ttl: number;

  constructor(
    private readonly redis: Redis,
    private readonly coreClient: CoreClient,
  ) {
    this.ttl = config.DICT_CACHE_TTL_SECONDS;
  }

  async getSimple(type: SimpleDictionaryType): Promise<Map<string, DictionaryEntry>> {
    return this.getCached(`waymates:dict:${type}`, async () => {
      const coreData = await this.coreClient.client.dictionaries.getVerified.query();
      const items = coreData[type];
      return new Map(items.map((entry) => [entry.canonicalName.toLowerCase(), entry]));
    });
  }

  async getReasons(): Promise<DictionaryEntry[]> {
    return this.getCachedArray("waymates:dict:reasons", async () => {
      const coreData = await this.coreClient.client.dictionaries.getVerified.query();
      return coreData.reasons;
    });
  }

  /**
   * Load all dictionaries for LLM extraction prompts.
   * Returns canonicalName arrays ready to inject into KNOWN_* hints.
   */
  async getForExtraction(): Promise<ExtractionDictionaries> {
    const [role, position, domain, skill, industry] = await Promise.all([
      this.getSimple("role"),
      this.getSimple("position"),
      this.getSimple("domain"),
      this.getSimple("skill"),
      this.getSimple("industry"),
    ]);

    return {
      role: [...role.values()].map((e) => e.canonicalName),
      position: [...position.values()].map((e) => e.canonicalName),
      domain: [...domain.values()].map((e) => e.canonicalName),
      skill: [...skill.values()].map((e) => e.canonicalName),
      industry: [...industry.values()].map((e) => e.canonicalName),
    };
  }

  async invalidate(type?: SimpleDictionaryType): Promise<void> {
    if (type) {
      await this.redis.del(`waymates:dict:${type}`);
      return;
    }

    const keys = await this.redis.keys("waymates:dict:*");
    if (keys.length > 0) {
      await this.redis.del(keys);
    }
  }

  private async getCached(
    key: string,
    fetcher: () => Promise<Map<string, DictionaryEntry>>,
  ): Promise<Map<string, DictionaryEntry>> {
    const cached = await this.redis.get(key);

    if (cached) {
      const cachedEntriesSchema = z.array(z.tuple([z.string(), dictionaryEntrySchema]));
      const entries = cachedEntriesSchema.parse(JSON.parse(cached));
      return new Map(entries);
    }

    const dict = await fetcher();
    await this.redis.setex(key, this.ttl, JSON.stringify([...dict.entries()]));

    return dict;
  }

  private async getCachedArray(key: string, fetcher: () => Promise<DictionaryEntry[]>): Promise<DictionaryEntry[]> {
    const cached = await this.redis.get(key);

    if (cached) {
      return z.array(dictionaryEntrySchema).parse(JSON.parse(cached));
    }

    const arr = await fetcher();
    await this.redis.setex(key, this.ttl, JSON.stringify(arr));

    return arr;
  }
}
