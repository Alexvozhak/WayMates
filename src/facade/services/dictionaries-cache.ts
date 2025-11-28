import { z } from "zod";

import { config } from "../env.js";

import type { SimpleDictionaryType } from "../../shared/schemas.js";
import type { CoreTRPCClient } from "../core-client/core-trpc-client.js";
import type { Redis } from "ioredis";

export class DictionariesCache {
  private readonly ttl: number;

  constructor(
    private readonly redis: Redis,
    private readonly coreClient: CoreTRPCClient,
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
    const rawItems = coreData[type];

    if (!Array.isArray(rawItems)) {
      throw new TypeError(`Invalid dictionaries response: ${type} is not an array`);
    }

    if (!this.isStringArray(rawItems)) {
      throw new TypeError(`Invalid dictionaries response: ${type} should contain strings`);
    }

    const dict = new Map(rawItems.map((name) => [name.toLowerCase(), name]));

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

  private isStringArray(items: unknown[]): items is string[] {
    return items.every((item) => typeof item === "string");
  }
}
