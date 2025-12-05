import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";

import { NlpParseError } from "../errors.js";

const searchParamsSchema = z.object({
  position: z.string().min(1).describe("Job position/title (required)"),
  organization: z.string().optional().describe("Company/organization name"),
  location: z.string().optional().describe("Geographic location"),
  domain: z.string().optional().describe("Industry/domain"),
  skills: z.array(z.string()).default([]).describe("Technical or professional skills"),
});

export type SearchParams = z.infer<typeof searchParamsSchema>;

export async function parseSearchQuery(apiKey: string, query: string): Promise<SearchParams> {
  const llm = new ChatOpenAI({ modelName: "gpt-4o-mini", temperature: 0, openAIApiKey: apiKey });
  const structuredLlm = llm.withStructuredOutput(searchParamsSchema);

  try {
    const result = await structuredLlm.invoke(`Extract search parameters from user query: ${query}`);
    return {
      ...result,
      skills: result.skills ?? [],
    };
  } catch (error) {
    const cause = error instanceof Error ? error : undefined;
    throw new NlpParseError("Failed to parse search query", cause);
  }
}
