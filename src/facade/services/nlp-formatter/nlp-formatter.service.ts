import { z } from "zod";

import { logger } from "../../logger.js";

import { GRAPH_PROMPTS, GUARD_DESCRIPTIONS, GUARD_PROMPT } from "./prompts.js";

import type { GraphType, GuardType } from "./prompts.js";
import type { AnyGraphResponse, Locale } from "../../../shared/schemas.js";
import type { ChatOpenAI } from "@langchain/openai";

const nlpResponseSchema = z.object({
  reasoning: z.string().describe("Brief explanation of formatting decisions based on phase and data"),
  text: z.string().describe("The formatted response text for user"),
});

const LANGUAGE_MAP: Record<Locale, string> = {
  en: "English",
  ru: "Russian",
};

export class NlpFormatter {
  private readonly llm: ChatOpenAI;

  constructor(llm: ChatOpenAI) {
    this.llm = llm;
  }

  async format(result: AnyGraphResponse, graphType: GraphType, locale: Locale): Promise<string> {
    const prompt = GRAPH_PROMPTS[graphType];
    const data = JSON.stringify(result, null, 2);
    const language = LANGUAGE_MAP[locale];
    const fullPrompt = prompt.replace("{data}", data).replace("{language}", language);

    const structuredLlm = this.llm.withStructuredOutput(nlpResponseSchema);
    const response = await structuredLlm.invoke(fullPrompt);
    const parsed = nlpResponseSchema.parse(response);

    logger.info({ reasoning: parsed.reasoning, phase: result.phase, locale }, "NLP formatter reasoning");

    return parsed.text.trim();
  }

  async formatGuard(guardType: GuardType, locale: Locale): Promise<string> {
    const language = LANGUAGE_MAP[locale];
    const description = GUARD_DESCRIPTIONS[guardType];
    const fullPrompt = GUARD_PROMPT.replace("{description}", description).replace("{language}", language);

    const structuredLlm = this.llm.withStructuredOutput(nlpResponseSchema);
    const response = await structuredLlm.invoke(fullPrompt);
    const parsed = nlpResponseSchema.parse(response);

    logger.info({ reasoning: parsed.reasoning, guardType, locale }, "Guard formatter reasoning");

    return parsed.text.trim();
  }
}
