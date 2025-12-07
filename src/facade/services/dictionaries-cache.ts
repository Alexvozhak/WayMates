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
    const key = `waymates:dict:${type}`;
    const cached = await this.redis.get(key);

    if (cached) {
      const cachedEntriesSchema = z.array(z.tuple([z.string(), z.string()]));
      const entries = cachedEntriesSchema.parse(JSON.parse(cached));
      return new Map(entries);
    }

    const coreData = await this.coreClient.client.dictionaries.getVerified.query();
    const items = coreData[type];
    const dict = new Map(items.map((name) => [name.toLowerCase(), name]));

    await this.redis.setex(key, this.ttl, JSON.stringify([...dict.entries()]));

    return dict;
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
}
