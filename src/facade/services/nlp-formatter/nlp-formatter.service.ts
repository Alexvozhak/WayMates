import { GRAPH_PROMPTS } from "./prompts.js";

import type { GraphType } from "./prompts.js";
import type { AnyGraphResponse } from "../../../shared/schemas.js";
import type { ChatOpenAI } from "@langchain/openai";

export class NlpFormatter {
  constructor(private readonly llm: ChatOpenAI) {}

  async format(result: AnyGraphResponse, graphType: GraphType): Promise<string> {
    const prompt = GRAPH_PROMPTS[graphType];
    const data = JSON.stringify(result, null, 2);
    const fullPrompt = prompt.replace("{data}", data);

    const response = await this.llm.invoke(fullPrompt);
    const content = typeof response.content === "string" ? response.content : String(response.content);

    return content.trim();
  }
}
