import { z } from "zod";

import { config } from "../env.js";

import type { SimpleDictionaryType } from "../../shared/schemas.js";
import type { CoreClient } from "../core-client.js";
import type { Redis } from "ioredis";

export class DictionariesCache {
  private readonly ttl: number;

  constructor(
    private readonly redis: Redis,
    private readonly coreClient: CoreClient,
  ) {
    this.ttl = config.DICT_CACHE_TTL_SECONDS;
  }

  async getSimple(type: SimpleDictionaryType): Promise<Map<string, string>> {
    return this.getCached(`waymates:dict:${type}`, async () => {
      const coreData = await this.coreClient.client.dictionaries.getVerified.query();
      const items = coreData[type];
      return new Map(items.map((name) => [name.toLowerCase(), name]));
    });
  }

  async getReasons(): Promise<Map<string, string>> {
    return this.getCached("waymates:dict:reasons", async () => {
      const coreData = await this.coreClient.client.dictionaries.getVerified.query();
      return new Map(coreData.reasons.map((canonicalName) => [canonicalName, canonicalName]));
    });
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

  private async getCached(key: string, fetcher: () => Promise<Map<string, string>>): Promise<Map<string, string>> {
    const cached = await this.redis.get(key);

    if (cached) {
      const cachedEntriesSchema = z.array(z.tuple([z.string(), z.string()]));
      const entries = cachedEntriesSchema.parse(JSON.parse(cached));
      return new Map(entries);
    }

    const dict = await fetcher();
    await this.redis.setex(key, this.ttl, JSON.stringify([...dict.entries()]));

    return dict;
  }
}
