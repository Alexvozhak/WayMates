import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { z } from "zod";

import { getModel } from "../langchain/shared-tools/models.js";

import type { SimpleDictionaryType } from "../../shared/schemas.js";
import type { ChatOpenAI } from "@langchain/openai";

const fuzzyMatchResultSchema = z.object({
  canonical: z.string().nullable(),
  confidence: z.enum(["high", "medium", "low"]),
  reasoning: z.string(),
});

export class LLMFuzzyMatcher {
  private readonly model: ChatOpenAI;
  private readonly parser: StructuredOutputParser<typeof fuzzyMatchResultSchema>;
  private readonly prompt: ChatPromptTemplate;

  constructor() {
    this.model = getModel("deterministic");

    this.parser = StructuredOutputParser.fromZodSchema(fuzzyMatchResultSchema);

    this.prompt = ChatPromptTemplate.fromTemplate(`You are a term normalization assistant for career data.

Dictionary ({type}): {dictEntries}

Task: Find the canonical name for "{value}" from the dictionary above.
Rules:
- Handle typos (e.g., "Pyton" → "python")
- Handle translation (e.g., "питон" → "python")
- Handle case variations (e.g., "PYTHON" → "python")
- If no good match (similarity < 0.7), return null
- NO hallucinations - only use provided dictionary

{formatInstructions}

Output ONLY valid JSON, no markdown.`);
  }

  async fuzzyMatch(type: SimpleDictionaryType, value: string, dict: Map<string, string>): Promise<string | null> {
    if (dict.size === 0) {
      throw new TypeError(
        `Cannot fuzzy match ${type}:"${value}" with empty dictionary. ` +
          `This indicates missing dictionary data or incorrect dictionary type.`,
      );
    }

    const dictEntries = [...dict.values()].map((name) => `"${name}"`).join(", ");
    const chain = this.prompt.pipe(this.model).pipe(this.parser);

    const result = await chain.invoke({
      type,
      dictEntries,
      value,
      formatInstructions: this.parser.getFormatInstructions(),
    });

    if (!result.canonical) {
      return null;
    }

    return dict.get(result.canonical.toLowerCase()) ?? null;
  }
}
