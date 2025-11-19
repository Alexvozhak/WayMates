import { z } from "zod";

import { executeSearchCareers } from "../../langchain/search-careers-agent.js";

import { BaseTool } from "./base-tool.js";

import type { SearchCareersParams } from "../../langchain/search-careers-agent.js";
import type { SessionId } from "../result.js";

// Schema for NLP-based search (text input instead of structured context)
export const searchCareersNLPParamsSchema = z.object({
  from: z.string().describe("Current position/context description in natural language"),
  to: z.string().optional().describe("Target position/context description (optional)"),
  sessionId: z.string().describe("Session ID for authentication"),
});

export type SearchCareersNLPParams = z.infer<typeof searchCareersNLPParamsSchema>;

/**
 * NLP-based search careers tool that uses LangChain agent
 * Processes natural language input and extracts context automatically
 */
export class SearchCareersNLPTool extends BaseTool<SearchCareersNLPParams, unknown> {
  protected extractSessionId(params: SearchCareersNLPParams): SessionId {
    return params.sessionId as SessionId;
  }

  protected async executeImpl(
    params: SearchCareersNLPParams,
    _userId: string, // userId is handled by the agent internally
  ): Promise<unknown> {
    // Execute search using LangChain agent
    const agentParams: SearchCareersParams = {
      from: params.from,
      to: params.to,
      sessionId: params.sessionId,
    };

    const result = await executeSearchCareers(agentParams, this.session, this.coreClient);

    return result;
  }
}
