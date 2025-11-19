/**
 * Search Careers Agent using createAgent
 * Handles career path search requests using LangChain v1.0 createAgent API
 */


import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { createAgent, tool } from "langchain";
import { z } from "zod";

import { scoredMatchedCandidateSchema, userContextSchema } from "../../shared/schemas.js";
import { sessionIdSchema } from "../mcp-server/result.js";

import type { UserContext } from "../../shared/schemas.js";
import type { CoreTRPCClient } from "../core-client/core-trpc-client.js";
import type { SessionMiddleware } from "../mcp-server/session-middleware.js";
import type { DynamicStructuredTool } from "@langchain/core/tools";

// Input schema for search_careers
export const searchCareersParamsSchema = z.object({
  from: z.string().describe("Current position/context description in natural language"),
  to: z.string().optional().describe("Target position/context description (optional)"),
  sessionId: z.string().describe("Session ID for authentication"),
});

export type SearchCareersParams = z.infer<typeof searchCareersParamsSchema>;

/**
 * Create extract context tool
 * Returns a DynamicStructuredTool for createAgent
 */
function createExtractContextTool(): DynamicStructuredTool {
  return tool(
    (input: { text: string; isTarget: boolean }): string => {
      console.log("🔧 Extracting context from:", input.text);
      // In production: would call dictionaries.getVerified() and normalize
      // For MVP: return a complete valid UserContext as JSON
      const mockContext: UserContext = {
        contextId: `ctx_${Date.now()}`,
        createdAt: new Date().toISOString(),
        creationReason: ["started_working"],
        position: "Junior Python Developer",
        domains: ["backend", "data"],
        skills: ["Python", "Django", "PostgreSQL"],
        industry: "technology",
        companySize: "medium",
        countryCode: "US",
        cityName: "New York",
        citizenships: ["US"],
        birthYear: 1995,
        educationLevel: "BACHELOR",
      };

      // Validate with schema before returning
      const validated = userContextSchema.parse(mockContext);
      const result = JSON.stringify(validated);
      console.log("✅ Extracted context (JSON length):", result.length);
      return result;
    },
    {
      name: "extract_context",
      description: "Extract and normalize career context from natural language description",
      schema: z.object({
        text: z.string().describe("Natural language description of position/context"),
        isTarget: z.boolean().describe("Whether this is target context (true) or current (false)"),
      }),
    },
  );
}

/**
 * Create search careers tool
 * Returns a DynamicStructuredTool for createAgent
 */
function createSearchCareersTool(
  sessionMiddleware: SessionMiddleware,
  coreClient: CoreTRPCClient,
): DynamicStructuredTool {
  return tool(
    async (input: { currentContext: string; sessionId: string }) => {
      // Parse and validate context using Zod
      console.log("🔍 Search careers with context:", input.currentContext);
      const parsedContext = JSON.parse(input.currentContext);
      const referenceContext = userContextSchema.parse(parsedContext);

      // Validate session and get userId
      const sessionIdValidated = sessionIdSchema.parse(input.sessionId);
      const userId = await sessionMiddleware.validate(sessionIdValidated);
      console.log("✅ Got userId from session:", userId);

      // Call Core API
      // Note: targetContext (goal) is fetched from DB if user has set one
      // For now, using adhoc search with referenceContext only
      const results = await coreClient.client.search.adhoc.query({
        userId,
        referenceContext,
        excludedContextFields: [],
        excludedCreationReasons: [],
        limit: 20,
        pathLimit: 10,
      });

      // Validate results using schema and take top 5
      const validatedResults = z.array(scoredMatchedCandidateSchema).parse(results).slice(0, 5);

      // Return validated results for LLM to process
      return JSON.stringify(validatedResults);
    },
    {
      name: "search_careers",
      description: "Search for career paths using Core API",
      schema: z.object({
        currentContext: z.string().describe("JSON string of current user context"),
        sessionId: z.string().describe("Session ID for authentication"),
      }),
    },
  );
}

/**
 * Create a search careers agent with LangChain tools
 */
export function createSearchCareersAgent(
  sessionMiddleware: SessionMiddleware,
  coreClient: CoreTRPCClient,
): ReturnType<typeof createAgent> {
  // Initialize LLM
  // ⚠️ КРИТИЧНО: Модели Gemini ВСЕГДА с префиксом "models/"
  const llm = new ChatGoogleGenerativeAI({
    model: "models/gemini-2.0-flash", // ✅ С префиксом!
    temperature: 0.3,
  });

  // Create tools
  const extractContextTool = createExtractContextTool();
  const searchCareersTool = createSearchCareersTool(sessionMiddleware, coreClient);

  // Create the agent with tools
  const agent = createAgent({
    model: llm,
    tools: [extractContextTool, searchCareersTool],
    systemPrompt: `You are a career path advisor. Help users find career transitions.

    IMPORTANT WORKFLOW:
    1. First, ALWAYS call extract_context with the user's text description (set isTarget=false for current position)
    2. Then call search_careers with the JSON context returned from extract_context and the session ID
    3. Finally, summarize the career paths found in the results

    Example flow:
    User: "Find career paths from Junior Python Developer"
    You: Call extract_context(text="Junior Python Developer", isTarget=false) → returns JSON context
    You: Call search_careers(currentContext=<JSON from extract_context>, sessionId="sess_xxx")
    You: Summarize the results

    Note: The session ID is always provided at the end of the user's message.
    Keep responses concise and focused on actionable career advice.`,
  });

  return agent;
}

/**
 * Execute search using the agent
 */
export async function executeSearchCareers(
  params: SearchCareersParams,
  sessionMiddleware: SessionMiddleware,
  coreClient: CoreTRPCClient,
): Promise<unknown> {
  // Create agent
  const agent = createSearchCareersAgent(sessionMiddleware, coreClient);

  // Prepare input message
  // Note: 'to' parameter is kept for future when we integrate goal-based search
  const message = params.to
    ? `Find career paths from "${params.from}" towards "${params.to}". Session: ${params.sessionId}`
    : `Find career paths similar to "${params.from}". Session: ${params.sessionId}`;

  // Execute agent
  const result = await agent.invoke({
    messages: [
      {
        role: "user",
        content: message,
      },
    ],
  });

  return result;
}
