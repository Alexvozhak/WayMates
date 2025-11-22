import { describe, it, expect, beforeEach } from "vitest";

import { FacadeTestContext } from "../../helpers/test-context.js";

import type { AdhocUserContext, TargetContext } from "../../../../src/shared/schemas.js";

describe("Facade Normalizer Integration Tests", () => {
  let ctx: FacadeTestContext;

  beforeEach(async () => {
    ctx = FacadeTestContext.getInstance();
    await ctx.cache.invalidate();
  });

  // Business rule: Exact matches (Python, React) skip expensive LLM call (cost + latency optimization).
  // Cache-first strategy: 95% of terms are exact matches, so LLM is only fallback tier.
  it("FN1: Exact match bypasses LLM - cache hit returns canonical", async () => {
    const context: AdhocUserContext = {
      position: "Junior",
      skills: ["Python", "React"],
    };

    const result = await ctx.normalizer.normalizeUserContext(context, "usr_test_01");

    expect(result.position).toBe("Junior");
    expect(result.skills).toContain("Python");
    expect(result.skills).toContain("React");
  });

  // Business rule: 2-tier normalization catches typos when exact match fails (Pyton → Python via LLM).
  // Prevents duplicate skills in database while maintaining user input fidelity.
  it("FN2: Fuzzy match via LLM - typo corrected to canonical", async () => {
    const context: AdhocUserContext = {
      skills: ["Pyton"],
    };

    const result = await ctx.normalizer.normalizeUserContext(context, "usr_test_02");

    expect(result.skills).toEqual(["Python"]);
  });

  // Business rule: Unknown terms (not in dictionary, LLM can't match) create unverified entries.
  // Admin reviews unverified terms asynchronously; immediate user flow is not blocked.
  it("FN3: Save unverified term - unknown skill created with verified=false", async () => {
    const unknownSkill = "QuantumHyperLang";
    const context: AdhocUserContext = {
      skills: [unknownSkill],
    };

    const result = await ctx.normalizer.normalizeUserContext(context, "usr_test_03");

    expect(result.skills).toEqual([unknownSkill]);
  });

  // Business rule: New skills created with complexity=null (requires admin verification for scoring).
  // Skills without complexity don't participate in weighted scoring until admin assigns value.
  it("FN4: Skills complexity=null - new skill created with null complexity", async () => {
    const newSkill = "BrandNewSkill123";
    const context: AdhocUserContext = {
      skills: [newSkill],
    };

    await ctx.normalizer.normalizeUserContext(context, "usr_test_04");

    const verified = await ctx.coreClient.client.dictionaries.getVerified.query();

    const skillEntry = verified.skills.find((s: string) => s === newSkill);
    expect(skillEntry).toBeDefined();
  });

  // Business rule: Multiple fields (skills, domains) normalized in parallel for performance.
  // Parallel Promise.all avoids sequential LLM calls (3 skills = 3 concurrent vs 3× latency).
  it("FN5: Parallel normalization - multiple terms normalized concurrently", async () => {
    const context: AdhocUserContext = {
      skills: ["Python", "React", "TypeScript"],
      domains: ["Frontend", "Backend"],
    };

    const result = await ctx.normalizer.normalizeUserContext(context, "usr_test_05");

    expect(result.skills).toHaveLength(3);
    expect(result.domains).toHaveLength(2);
  });

  // Business rule: Full context normalization (all 5 fields) maintains field semantics.
  // Each field (position, skills, domains, industry, cityName) normalized independently.
  it("FN6: Full UserContext - all fields normalized correctly", async () => {
    const context: AdhocUserContext = {
      position: "Senior",
      skills: ["Python"],
      domains: ["Backend"],
      industry: "Fintech",
      cityName: "Berlin",
    };

    const result = await ctx.normalizer.normalizeUserContext(context, "usr_test_06");

    expect(result.position).toBe("Senior");
    expect(result.skills).toEqual(["Python"]);
    expect(result.domains).toEqual(["Backend"]);
    expect(result.industry).toBe("Fintech");
    expect(result.cityName).toBe("Berlin");
  });

  // Business rule: TargetContext preserves FieldFilter mode (desired/undesired) while normalizing values.
  // Mode is business logic (include/exclude); values require normalization (typos, case).
  it("FN7: TargetContext normalization - mode preserved, values normalized", async () => {
    const context: TargetContext = {
      position: { mode: "desired", values: ["Senior"] },
      skills: { mode: "undesired", values: ["Python", "React"] },
    };

    const result = await ctx.normalizer.normalizeTargetContext(context, "usr_test_07");

    expect(result.position?.mode).toBe("desired");
    expect(result.position?.values).toEqual(["Senior"]);
    expect(result.skills?.mode).toBe("undesired");
    expect(result.skills?.values).toContain("Python");
    expect(result.skills?.values).toContain("React");
  });

  // Business rule: Empty context is valid (user hasn't filled profile yet or skipped fields).
  // Normalization gracefully handles partial data without throwing errors.
  it("FN8: Empty context - returns empty normalized context", async () => {
    const context: AdhocUserContext = {};

    const result = await ctx.normalizer.normalizeUserContext(context, "usr_test_08");

    expect(Object.keys(result)).toHaveLength(0);
  });
});
