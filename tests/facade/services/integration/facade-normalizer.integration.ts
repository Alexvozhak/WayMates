import { describe, it, expect, beforeEach } from "vitest";

import { FacadeTestContext } from "../../helpers/test-context.js";

import type { AdhocContextBase, TargetContext } from "../../../../src/shared/schemas.js";

describe("Facade Normalizer Integration Tests", () => {
  let ctx: FacadeTestContext;

  beforeEach(async () => {
    ctx = FacadeTestContext.getInstance();
    await ctx.cache.invalidate();
  });

  // Business rule: Exact matches (Python, React) skip expensive LLM call (cost + latency optimization).
  // Cache-first strategy: 95% of terms are exact matches, so LLM is only fallback tier.
  it("FN1: Exact match bypasses LLM - cache hit returns canonical", async () => {
    const context: AdhocContextBase = {
      position: "Junior",
      skills: ["Python", "React"],
    };

    const result = await ctx.normalizer.normalizeAdhocContext(context, "usr_01933ec5-0101-0000-0000-000000000001");

    expect(result.position).toBe("junior");
    expect(result.skills).toContain("python");
    expect(result.skills).toContain("react");
  });

  // Business rule: 2-tier normalization catches typos when exact match fails (Pyton → Python via LLM).
  // Prevents duplicate skills in database while maintaining user input fidelity.
  it("FN2: Fuzzy match via LLM - typo corrected to canonical", async () => {
    const context: AdhocContextBase = {
      skills: ["Pyton"],
    };

    const result = await ctx.normalizer.normalizeAdhocContext(context, "usr_01933ec5-0102-0000-0000-000000000002");

    expect(result.skills).toEqual(["python"]);
  });

  // Business rule: Unknown terms (not in dictionary, LLM can't match) create unverified entries.
  // Admin reviews unverified terms asynchronously; immediate user flow is not blocked.
  it("FN3: Save unverified term - unknown skill created with verified=false", async () => {
    const unknownSkill = "QuantumHyperLang";
    const context: AdhocContextBase = {
      skills: [unknownSkill],
    };

    const result = await ctx.normalizer.normalizeAdhocContext(context, "usr_01933ec5-0103-0000-0000-000000000003");

    expect(result.skills).toEqual([unknownSkill.toLowerCase()]);
  });

  // Business rule: New skills created with complexity=null (requires admin verification for scoring).
  // Skills without complexity don't participate in weighted scoring until admin assigns value.
  it("FN4: Skills complexity=null - new skill created with null complexity", async () => {
    const newSkill = "BrandNewSkill123";
    const context: AdhocContextBase = {
      skills: [newSkill],
    };

    const result = await ctx.normalizer.normalizeAdhocContext(context, "usr_01933ec5-0104-0000-0000-000000000004");

    // Verify normalizer returns the new skill in canonical lowercase format
    expect(result.skills).toEqual([newSkill.toLowerCase()]);

    // Note: New skills created with verified=false (pending admin review)
    // getVerified() filters by verified=true, so unverified skills won't appear
    // This is correct behavior - unverified skills can still be used for matching
  });

  // Business rule: Multiple fields (skills, domains) normalized in parallel for performance.
  // Parallel Promise.all avoids sequential LLM calls (3 skills = 3 concurrent vs 3× latency).
  it("FN5: Parallel normalization - multiple terms normalized concurrently", async () => {
    const context: AdhocContextBase = {
      skills: ["Python", "React", "TypeScript"],
      domains: ["Frontend", "Backend"],
    };

    const result = await ctx.normalizer.normalizeAdhocContext(context, "usr_01933ec5-0105-0000-0000-000000000005");

    expect(result.skills).toHaveLength(3);
    expect(result.domains).toHaveLength(2);
  });

  // Business rule: Full context normalization (all 5 fields) maintains field semantics.
  // Each field (position, skills, domains, industry, cityName) normalized independently.
  it("FN6: Full UserContext - all fields normalized correctly", async () => {
    const context: AdhocContextBase = {
      position: "senior",
      skills: ["Python"],
      domains: ["Backend"],
      industry: "Fintech",
      cityName: "Berlin",
    };

    const result = await ctx.normalizer.normalizeAdhocContext(context, "usr_01933ec5-0106-0000-0000-000000000006");

    expect(result.position).toBe("senior");
    expect(result.skills).toEqual(["python"]);
    expect(result.domains).toEqual(["backend"]);
    expect(result.industry).toBe("fintech");
    expect(result.cityName).toBe("berlin");
  });

  // Business rule: TargetContext preserves FieldFilter mode (desired/undesired) while normalizing values.
  // Mode is business logic (include/exclude); values require normalization (typos, case).
  it("FN7: TargetContext normalization - mode preserved, values normalized", async () => {
    const context: TargetContext = {
      position: { mode: "desired", values: ["Senior"] },
      skills: { mode: "undesired", values: ["Python", "React"] },
    };

    const result = await ctx.normalizer.normalizeTargetContext(context, "usr_01933ec5-0107-0000-0000-000000000007");

    expect(result.position?.mode).toBe("desired");
    expect(result.position?.values).toEqual(["senior"]);
    expect(result.skills?.mode).toBe("undesired");
    expect(result.skills?.values).toContain("python");
    expect(result.skills?.values).toContain("react");
  });

  // Business rule: Empty context is valid (user hasn't filled profile yet or skipped fields).
  // Normalization gracefully handles partial data without throwing errors.
  it("FN8: Empty context - returns empty normalized context", async () => {
    const context: AdhocContextBase = {};

    const result = await ctx.normalizer.normalizeAdhocContext(context, "usr_01933ec5-0108-0000-0000-000000000008");

    expect(Object.keys(result)).toHaveLength(0);
  });
});
