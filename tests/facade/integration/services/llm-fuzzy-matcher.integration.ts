import { describe, it, expect, beforeAll } from "vitest";

import { FacadeTestContext } from "../../helpers/test-context.js";

import type { SimpleDictionaryType } from "../../../../src/shared/schemas.js";

describe("LLM Fuzzy Matcher Integration Tests", () => {
  let ctx: FacadeTestContext;
  let skillDict: Map<string, string>;

  beforeAll(() => {
    ctx = FacadeTestContext.getInstance();

    skillDict = new Map([
      ["python", "Python"],
      ["react", "React"],
      ["typescript", "TypeScript"],
      ["docker", "Docker"],
    ]);
  });

  // Business rule: Users often misspell tech terms (Pyton, Reactjs, etc) during onboarding.
  // LLM fuzzy matching prevents creating duplicate unverified terms and improves search accuracy.
  it("LFM1: Typo correction - fuzzy matches misspelled skill", async () => {
    const type: SimpleDictionaryType = "skill";
    const typo = "Pyton";

    const result = await ctx.llmMatcher.fuzzyMatch(type, typo, skillDict);

    expect(result).toBe("Python");
  });

  // Business rule: International users may input terms in native language (питон, パイソン).
  // Translation layer expands dictionary coverage without manual multi-language entries.
  it("LFM2: Translation RU→EN - handles Cyrillic input", async () => {
    const type: SimpleDictionaryType = "skill";
    const cyrillic = "питон";

    const result = await ctx.llmMatcher.fuzzyMatch(type, cyrillic, skillDict);

    expect(result).toBe("Python");
  });

  // Business rule: Case-insensitive matching (REACT, react, React) maps to canonical form.
  // Prevents data fragmentation where "React" and "REACT" are treated as different skills.
  it("LFM3: Case normalization - UPPERCASE to canonical", async () => {
    const type: SimpleDictionaryType = "skill";
    const uppercase = "REACT";

    const result = await ctx.llmMatcher.fuzzyMatch(type, uppercase, skillDict);

    expect(result).toBe("React");
  });

  // Business rule: LLM must NOT hallucinate skills outside verified dictionary (similarity threshold < 0.7).
  // Unknown terms return null to trigger "create unverified" flow, maintaining data integrity.
  it("LFM4: Hallucination prevention - unknown term returns null", async () => {
    const type: SimpleDictionaryType = "skill";
    const unknown = "QuantumComputing";

    const result = await ctx.llmMatcher.fuzzyMatch(type, unknown, skillDict);

    expect(result).toBeNull();
  });

  // Business rule: Completely dissimilar terms (cooking vs tech skills) should not fuzzy-match.
  // Prevents incorrect mappings that would corrupt career trajectory data.
  it("LFM5: Low similarity - dissimilar term returns null", async () => {
    const type: SimpleDictionaryType = "skill";
    const dissimilar = "cooking";

    const result = await ctx.llmMatcher.fuzzyMatch(type, dissimilar, skillDict);

    expect(result).toBeNull();
  });

  // Business rule: LLM may return malformed JSON during rate-limiting or service degradation.
  // System must fail gracefully (throw TypeError) rather than silently corrupt data.
  it("LFM6: Invalid JSON handling - throws TypeError on broken JSON", async () => {
    const type: SimpleDictionaryType = "skill";
    const emptyDict = new Map<string, string>();

    await expect(ctx.llmMatcher.fuzzyMatch(type, "test", emptyDict)).rejects.toThrow(TypeError);
  });
});
