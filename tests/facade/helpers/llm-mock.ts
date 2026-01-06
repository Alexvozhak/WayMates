import type { FuzzyMatchResult, FuzzyModel } from "../../../src/facade/services/normalizer.js";
import type { HumanMessage } from "@langchain/core/messages";

const typoMap: Record<string, string> = {
  pyton: "python",
  reactjs: "react",
  typescirpt: "typescript",
  питон: "python",
  реакт: "react",
};

export function createMockFuzzyModel(): FuzzyModel {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Test mock requires type assertion for Runnable interface
  return {
    invoke(messages: HumanMessage[]): Promise<FuzzyMatchResult> {
      const content = messages[0]?.content;
      if (typeof content !== "string") {
        return Promise.resolve({ canonical: null, suggestions: [], reasoning: "No content" });
      }

      const valueMatch = content.match(/Find the canonical name for "([^"]+)"/);
      if (!valueMatch?.[1]) {
        return Promise.resolve({ canonical: null, suggestions: [], reasoning: "Could not parse value" });
      }

      const value = valueMatch[1].toLowerCase().trim();
      const canonical = typoMap[value] ?? null;

      return Promise.resolve({
        canonical,
        suggestions: canonical ? [canonical] : [],
        reasoning: canonical ? `Matched typo "${value}" to "${canonical}"` : "No match found",
      });
    },
  } as FuzzyModel;
}
