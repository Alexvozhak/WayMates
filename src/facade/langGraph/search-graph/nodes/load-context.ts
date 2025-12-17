import { adhocUserContextSchema } from "../../../../shared/schemas.js";
import { AgentInvariantError } from "../../../errors.js";
import { GRAPH_INTENT } from "../../../services/orchestrator/intent-classifier.js";
import { hasConfigDeps } from "../../shared/types.js";
import { getModel } from "../../shared-tools/models.js";
import { ADHOC_CONTEXT_EXTRACTION_PROMPT } from "../prompts.js";
import { NODE } from "../state.js";

import type { AdhocUserContext } from "../../../../shared/schemas.js";
import type { SearchStateType } from "../state.js";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";

const extractor = getModel("extraction").withStructuredOutput(adhocUserContextSchema);

async function extractAdhocContext(message: string): Promise<AdhocUserContext | null> {
  const extracted = await extractor.invoke([
    { role: "system", content: ADHOC_CONTEXT_EXTRACTION_PROMPT },
    { role: "user", content: message },
  ]);

  console.log("[LOAD CONTEXT] LLM extracted raw:", JSON.stringify(extracted, null, 2));

  if (!extracted) return null;

  const hasAnyField = Object.values(extracted).some((v) => v != null);
  if (!hasAnyField) return null;

  // Inference: If position contains "backend/frontend/fullstack" but domains is null,
  // infer domains from position to improve matching
  // IMPORTANT: Create new object instead of mutating to ensure checkpoint serialization
  // IMPORTANT: Check for === null (not !extracted.domains) because makeNullable schema returns null, not undefined
  let inferredDomains: string[] | null = extracted.domains;
  if (extracted.position && extracted.domains === null) {
    const position = extracted.position.toLowerCase();
    if (position.includes("backend")) {
      inferredDomains = ["backend"];
    } else if (position.includes("frontend")) {
      inferredDomains = ["frontend"];
    } else if (position.includes("fullstack") || position.includes("full-stack")) {
      inferredDomains = ["frontend", "backend"];
    }
  }

  let result = inferredDomains !== extracted.domains
    ? { ...extracted, domains: inferredDomains }
    : extracted;

  // CRITICAL: Convert empty strings to null for proper WHERE clause filtering
  // LLM may return "" for fields not mentioned in message
  // Empty string causes exact match failure (e.g., companySize="" != "startup")
  // While null allows field to be excluded from strictFields
  result = Object.fromEntries(
    Object.entries(result).map(([key, value]) => [key, value === "" ? null : value])
  ) as typeof result;

  // CRITICAL: Normalize position to canonical seniority level
  // LLM may return "Junior Backend Developer", but Neo4j uses "junior"
  // Extract seniority level (junior/middle/senior) for proper matching
  if (result.position) {
    const positionLower = result.position.toLowerCase();
    if (positionLower.includes("junior")) {
      result.position = "junior";
    } else if (positionLower.includes("middle") || positionLower.includes("mid-level")) {
      result.position = "middle";
    } else if (positionLower.includes("senior")) {
      result.position = "senior";
    }
    // else: keep original if no seniority level found (e.g., "Backend Developer")
  }

  console.log("[LOAD CONTEXT] After normalization:", JSON.stringify(result, null, 2));

  return result;
}

export async function loadContextNode(
  state: SearchStateType,
  config: LangGraphRunnableConfig,
): Promise<Partial<SearchStateType>> {
  if (state.intent === GRAPH_INTENT.startAdhoc) {
    const adhocContext = await extractAdhocContext(state.userResponse);

    // DEBUG: Check what we're returning to state
    console.log("[LOAD CONTEXT NODE] Returning to state:", JSON.stringify({ adhocContext }, null, 2));

    // IMPORTANT: Clear userResponse after extraction to prevent show_exploration
    // from interpreting initial message as user intent (e.g., "proceed" → extract_goal)
    return { adhocContext, userResponse: "" };
  }

  if (!hasConfigDeps(config)) {
    throw new AgentInvariantError(NODE.load_context, "Config deps required");
  }
  const { coreClient } = config.configurable;

  const story = await coreClient.client.story.getStory.query({ userId: state.userId });
  const userContext = story.contexts.find((ctx) => ctx.nextContextId === null) ?? null;

  console.log("[LOAD CONTEXT NODE] Returning to state:", JSON.stringify({ userContext }, null, 2));

  return { userContext };
}
