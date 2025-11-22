import { HumanMessage } from "@langchain/core/messages";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { z } from "zod";

import type { SimpleDictionaryType } from "../../shared/schemas.js";

const fuzzyMatchResultSchema = z.object({
  canonical: z.string().nullable(),
  confidence: z.enum(["high", "medium", "low"]),
  reasoning: z.string(),
});

type FuzzyMatchResult = z.infer<typeof fuzzyMatchResultSchema>;

export class LLMFuzzyMatcher {
  private readonly model: ChatGoogleGenerativeAI;

  constructor(apiKey: string) {
    this.model = new ChatGoogleGenerativeAI({
      model: "models/gemini-2.5-flash",
      temperature: 0,
      apiKey,
    });
  }

  async fuzzyMatch(
    type: SimpleDictionaryType,
    value: string,
    dict: Map<string, string>,
  ): Promise<string | null> {
    const dictEntries = [...dict.values()].map((name) => `"${name}"`).join(", ");

    const prompt = `You are a term normalization assistant for career data.

Dictionary (${type}): ${dictEntries}

Task: Find the canonical name for "${value}" from the dictionary above.
Rules:
- Handle typos (e.g., "Pyton" → "python")
- Handle translation (e.g., "питон" → "python")
- Handle case variations (e.g., "PYTHON" → "python")
- If no good match (similarity < 0.7), return null
- NO hallucinations - only use provided dictionary

Output format:
{
  "canonical": "python" | null,
  "confidence": "high" | "medium" | "low",
  "reasoning": "Typo correction"
}`;

    const response = await this.model.invoke([new HumanMessage(prompt)]);

    if (typeof response.content !== "string") {
      throw new TypeError("LLM returned non-string content");
    }

    let parsed: FuzzyMatchResult;
    try {
      const jsonData = JSON.parse(response.content);
      parsed = fuzzyMatchResultSchema.parse(jsonData);
    } catch (error) {
      throw new TypeError(`LLM returned invalid JSON: ${response.content.slice(0, 200)}`, {
        cause: error,
      });
    }

    if (!parsed.canonical) {
      return null;
    }

    const canonicalValue = dict.get(parsed.canonical.toLowerCase());
    if (!canonicalValue) {
      return null;
    }

    return canonicalValue;
  }
}
