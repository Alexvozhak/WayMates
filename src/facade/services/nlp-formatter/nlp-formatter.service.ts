import { z } from "zod";

import { logger } from "../../logger.js";

import { GRAPH_PROMPTS } from "./prompts.js";

import type { GraphType } from "./prompts.js";
import type { AnyGraphResponse } from "../../../shared/schemas.js";
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

  async format(result: AnyGraphResponse, graphType: GraphType): Promise<string> {
    const prompt = GRAPH_PROMPTS[graphType];
    const data = JSON.stringify(result, null, 2);
    const fullPrompt = prompt.replace("{data}", data);

    const structuredLlm = this.llm.withStructuredOutput(nlpResponseSchema);
    const response = await structuredLlm.invoke(fullPrompt);
    const parsed = nlpResponseSchema.parse(response);

    logger.info({ reasoning: parsed.reasoning, phase: result.phase }, "NLP formatter reasoning");

    return parsed.text.trim();
  }
}
