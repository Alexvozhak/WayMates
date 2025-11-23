import type { LLMFuzzyMatcher } from "../../../src/facade/services/llm-fuzzy-matcher.js";
import type { SimpleDictionaryType } from "../../../src/shared/schemas.js";

export function createMockLLMFuzzyMatcher(): LLMFuzzyMatcher {
  return {
    fuzzyMatch(
      _type: SimpleDictionaryType,
      value: string,
      dict: Map<string, string>,
    ): Promise<string | null> {
      if (dict.size === 0) {
        return Promise.resolve(null);
      }

      const normalized = value.toLowerCase().trim();

      const typoMap: Record<string, string> = {
        pyton: "python",
        reactjs: "react",
        typescirpt: "typescript",
        питон: "python",
        реакт: "react",
      };

      const canonical = typoMap[normalized] ?? normalized;
      const result = dict.get(canonical) ?? null;
      return Promise.resolve(result);
    },
  } as LLMFuzzyMatcher;
}
