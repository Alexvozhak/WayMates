import { describe, it, expect, beforeEach } from "vitest";

import { FacadeTestContext } from "../../helpers/test-context.js";
import { adhocContextBase, targetContextSchema } from "../../../../src/shared/schemas.js";

describe("Facade Normalizer Integration Tests", () => {
  let ctx: FacadeTestContext;

  beforeEach(async () => {
    ctx = FacadeTestContext.getInstance();
    await ctx.dictionariesService.invalidate();
  });

  // Business rule: Exact matches (Python, React) skip expensive LLM call (cost + latency optimization).
  // Cache-first strategy: 95% of terms are exact matches, so LLM is only fallback tier.
  it("FN1: Exact match bypasses LLM - cache hit returns canonical", async () => {
    const context = adhocContextBase.parse({
      position: "Junior",
      skills: ["Python", "React"],
    });

    const result = await ctx.normalizerService.normalizeAdhocContext(
      context,
      "usr_01933ec5-0101-0000-0000-000000000001",
    );

    expect(result.position).toBe("junior");
    expect(result.skills).toContain("python");
    expect(result.skills).toContain("react");
  });

  // Business rule: Adhoc normalization uses filterToKnown (exact match only, no LLM fuzzy).
  // Unknown terms are REMOVED, not corrected — adhoc is for search, not profile creation.
  it("FN2: Unknown term filtered out - adhoc removes non-dictionary terms", async () => {
    const context = adhocContextBase.parse({
      skills: ["Pyton"], // typo, not in dictionary
    });

    const result = await ctx.normalizerService.normalizeAdhocContext(
      context,
      "usr_01933ec5-0102-0000-0000-000000000002",
    );

    // Adhoc mode: unknown skills are filtered out (not added to dictionary)
    expect(result.skills).toBeUndefined();
  });

  // Business rule: Mixed known/unknown terms — only known terms are kept.
  // Adhoc filters to dictionary values, unknown terms silently dropped.
  it("FN3: Mixed terms - only known skills kept, unknown filtered out", async () => {
    const context = adhocContextBase.parse({
      skills: ["Python", "QuantumHyperLang"], // Python exists, QuantumHyperLang doesn't
    });

    const result = await ctx.normalizerService.normalizeAdhocContext(
      context,
      "usr_01933ec5-0103-0000-0000-000000000003",
    );

    // Only known skill "python" is kept
    expect(result.skills).toEqual(["python"]);
  });

  // Business rule: All unknown terms → skills field removed entirely.
  // Adhoc search proceeds without skills filter (broader search).
  it("FN4: All unknown terms - skills field removed from result", async () => {
    const context = adhocContextBase.parse({
      skills: ["BrandNewSkill123", "AnotherUnknown"],
    });

    const result = await ctx.normalizerService.normalizeAdhocContext(
      context,
      "usr_01933ec5-0104-0000-0000-000000000004",
    );

    // All unknown → field removed (null filtered by removeNullishFields)
    expect(result.skills).toBeUndefined();
  });

  // Business rule: Multiple fields (skills, domains) normalized in parallel for performance.
  // Parallel Promise.all avoids sequential LLM calls (3 skills = 3 concurrent vs 3× latency).
  it("FN5: Parallel normalization - multiple terms normalized concurrently", async () => {
    const context = adhocContextBase.parse({
      skills: ["Python", "React", "TypeScript"],
      domains: ["Frontend", "Backend"],
    });

    const result = await ctx.normalizerService.normalizeAdhocContext(
      context,
      "usr_01933ec5-0105-0000-0000-000000000005",
    );

    expect(result.skills).toHaveLength(3);
    expect(result.domains).toHaveLength(2);
  });

  // Business rule: Full context normalization maintains field semantics.
  // Each field (position, skills, domains, industry) normalized independently.
  // Note: Only dictionary-known values are kept (adhoc = filterToKnown, not fuzzy match).
  // Note: cityName has NO dictionary, so it's always filtered out in adhoc mode.
  it("FN6: Full UserContext - all known fields normalized correctly", async () => {
    const context = adhocContextBase.parse({
      position: "Senior", // exists in dictionary
      skills: ["Python"], // exists in dictionary
      domains: ["Backend"], // exists in dictionary
      industry: "Finance", // exists in dictionary (NOT "Fintech"!)
      // Note: cityName not tested — no cities dictionary for adhoc filterToKnown
    });

    const result = await ctx.normalizerService.normalizeAdhocContext(
      context,
      "usr_01933ec5-0106-0000-0000-000000000006",
    );

    expect(result.position).toBe("senior");
    expect(result.skills).toEqual(["python"]);
    expect(result.domains).toEqual(["backend"]);
    expect(result.industry).toBe("finance");
    // cityName is undefined because no cities dictionary for adhoc filtering
  });

  // Business rule: TargetContext preserves FieldFilter mode (desired/undesired) while normalizing values.
  // Mode is business logic (include/exclude); values require normalization (typos, case).
  it("FN7: TargetContext normalization - mode preserved, values normalized", async () => {
    const context = targetContextSchema.parse({
      position: { mode: "desired", values: ["Senior"] },
      skills: { mode: "undesired", values: ["Python", "React"] },
    });

    const result = await ctx.normalizerService.normalizeTargetContext(
      context,
      "usr_01933ec5-0107-0000-0000-000000000007",
    );

    expect(result.position?.mode).toBe("desired");
    expect(result.position?.values).toEqual(["senior"]);
    expect(result.skills?.mode).toBe("undesired");
    expect(result.skills?.values).toContain("python");
    expect(result.skills?.values).toContain("react");
  });

  // Business rule: Empty context is valid (user hasn't filled profile yet or skipped fields).
  // Normalization gracefully handles partial data without throwing errors.
  it("FN8: Empty context - returns empty normalized context", async () => {
    const context = adhocContextBase.parse({});

    const result = await ctx.normalizerService.normalizeAdhocContext(
      context,
      "usr_01933ec5-0108-0000-0000-000000000008",
    );

    expect(Object.keys(result)).toHaveLength(0);
  });
});
