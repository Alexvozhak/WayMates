import { z } from "zod";

import { logger } from "../../logger.js";

import { buildGuardTranslationPrompt, GRAPH_PROMPT_BUILDERS, GUARD_TEMPLATES } from "./prompts.js";

import type { GraphType, GuardType } from "./prompts.js";
import type { AnyGraphResponse, Locale } from "../../../shared/schemas.js";
import type { ChatOpenAI } from "@langchain/openai";

const nlpResponseSchema = z.object({
  reasoning: z.string().describe("Brief explanation of formatting decisions based on phase and data"),
  text: z.string().describe("The formatted response text for user"),
});

export class NlpFormatter {
  private readonly llm: ChatOpenAI;

  constructor(llm: ChatOpenAI) {
    this.llm = llm;
  }

  async format(result: AnyGraphResponse, graphType: GraphType, locale: Locale): Promise<string> {
    const buildPrompt = GRAPH_PROMPT_BUILDERS[graphType];
    // Filter null values so LLM sees only filled fields and shows all of them
    const data = JSON.stringify(result, (_, value) => (value === null ? undefined : value), 2);
    const fullPrompt = buildPrompt(data, locale);

    const structuredLlm = this.llm.withStructuredOutput(nlpResponseSchema);
    const response = await structuredLlm.invoke(fullPrompt);
    const parsed = nlpResponseSchema.parse(response);

    logger.info({ reasoning: parsed.reasoning, phase: result.phase, locale }, "NLP formatter reasoning");

    return parsed.text.trim();
  }

  async formatGuard(guardType: GuardType, locale: Locale): Promise<string> {
    const template = GUARD_TEMPLATES[guardType];

    // English — return template as-is, no LLM call
    if (locale === "en") {
      return template;
    }

    // Other languages — translate via LLM
    const prompt = buildGuardTranslationPrompt(template, locale);

    const structuredLlm = this.llm.withStructuredOutput(nlpResponseSchema);
    const response = await structuredLlm.invoke(prompt);
    const parsed = nlpResponseSchema.parse(response);

    logger.info({ reasoning: parsed.reasoning, guardType, locale }, "Guard translation reasoning");

    return parsed.text.trim();
  }
}
