import { buildGuardTranslationPrompt, GRAPH_PROMPT_BUILDERS, GUARD_TEMPLATES } from "@prompts/nlp-formatter.js";
import { z } from "zod";

import { logger } from "../../logger.js";


import type { AnyGraphResponse, Locale } from "../../../shared/schemas.js";
import type { ChatOpenAI } from "@langchain/openai";
import type { GraphType, GuardType } from "@prompts/nlp-formatter.js";

const nlpResponseSchema = z.object({
  reasoning: z.string().describe(
    `Reasoning steps (adapt to phase):
1) State locale
2) Check phase — follow phase-specific instructions from prompt
3) For results phases: check answerText first, use resultsCount (not array counting)
4) For goal display: list fields with ✅/⚪
5) For confirmation phases: just show context and offer choices`,
  ),
  text: z.string().describe("The formatted response text for user"),
});

export class NlpFormatter {
  private readonly llm: ChatOpenAI;

  constructor(llm: ChatOpenAI) {
    this.llm = llm;
  }

  async format(result: AnyGraphResponse, graphType: GraphType, _locale: Locale): Promise<string> {
    const buildPrompt = GRAPH_PROMPT_BUILDERS[graphType];
    // Filter null values so LLM sees only filled fields and shows all of them
    const data = JSON.stringify(result, (_, value) => (value === null ? undefined : value), 2);
    // TODO: temporary fix — force English until locale handling is stabilized
    const locale: Locale = "en";
    const fullPrompt = buildPrompt(data, locale);

    const structuredLlm = this.llm.withStructuredOutput(nlpResponseSchema);
    const response = await structuredLlm.invoke(fullPrompt);
    const parsed = nlpResponseSchema.parse(response);

    const phase = "phase" in result ? result.phase : graphType;
    logger.info({ reasoning: parsed.reasoning, phase, locale }, "NLP formatter reasoning");

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
