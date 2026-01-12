import { beforeEach, describe, expect, it } from "vitest";

import { FacadeTestContext } from "../../helpers/test-context.js";

import type { SimpleDictionaryType } from "@shared/schemas.js";

describe("DictionariesCache Integration Tests", () => {
  let ctx: FacadeTestContext;

  beforeEach(() => {
    ctx = FacadeTestContext.getInstance();
  });

  // Business rule: Cache reduces Core API load and speeds up normalization (user-facing latency).
  // Redis hit → instant canonical lookup without network roundtrip to Core.
  it("DC1: Cache hit returns canonical names from Redis", async () => {
    const type: SimpleDictionaryType = "skill";
    const testData = new Map([
      ["python", { canonicalName: "Python", description: "General-purpose programming language" }],
      ["react", { canonicalName: "React", description: "JavaScript library for building UIs" }],
    ]);

    await ctx.redis.setex(`waymates:dict:${type}`, 3600, JSON.stringify([...testData.entries()]));

    const result = await ctx.dictionariesService.getSimple(type);

    expect(result.get("python")?.canonicalName).toBe("Python");
    expect(result.get("react")?.canonicalName).toBe("React");
  });

  // Business rule: Cache miss triggers fallback to Core API (verified dictionaries).
  // Freshly loaded data is cached with TTL to prevent repeated Core calls for same dictionary.
  it("DC2: Cache miss loads from Core API", async () => {
    const type: SimpleDictionaryType = "position";

    await ctx.redis.del(`waymates:dict:${type}`);

    const result = await ctx.dictionariesService.getSimple(type);

    expect(result.size).toBeGreaterThan(0);
    console.log("[DC2] Available positions:", [...result.keys()]);
    const hasJunior = result.has("junior");
    expect(hasJunior).toBe(true);

    const cached = await ctx.redis.get(`waymates:dict:${type}`);
    expect(cached).not.toBeNull();
  });

  // Business rule: Admin updates to dictionaries (new skills, positions) require cache invalidation.
  // Without invalidation, users would see stale data until TTL expires (potential 24h delay).
  it("DC3: Invalidate clears cache", async () => {
    const type: SimpleDictionaryType = "domain";
    const testData = new Map([["backend", { canonicalName: "Backend", description: "Server-side development" }]]);

    await ctx.redis.setex(`waymates:dict:${type}`, 3600, JSON.stringify([...testData.entries()]));

    await ctx.dictionariesService.invalidate(type);

    const cached = await ctx.redis.get(`waymates:dict:${type}`);
    expect(cached).toBeNull();
  });
});
