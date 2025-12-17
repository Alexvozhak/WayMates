import { adhocContextBase, makeNullable } from "../../../../shared/schemas.js";
import { AgentInvariantError } from "../../../errors.js";
import { GRAPH_INTENT } from "../../../services/orchestrator/intent-classifier.js";
import { hasConfigDeps } from "../../shared/types.js";
import { getModel } from "../../shared-tools/models.js";
import { ADHOC_CONTEXT_EXTRACTION_PROMPT } from "../prompts.js";
import { NODE } from "../state.js";

import type { AdhocUserContext } from "../../../../shared/schemas.js";
import type { SearchStateType } from "../state.js";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";

// LLM extraction schema: makeNullable wrapper for OpenAI Structured Output compatibility
// ADR-031: makeNullable applied locally, not exported from schemas
const extractableAdhocSchema = makeNullable(adhocContextBase);
const extractor = getModel("extraction").withStructuredOutput(extractableAdhocSchema);

async function extractAdhocContext(message: string): Promise<AdhocUserContext | null> {
  const extracted = await extractor.invoke([
    { role: "system", content: ADHOC_CONTEXT_EXTRACTION_PROMPT },
    { role: "user", content: message },
  ]);

  if (!extracted) return null;

  const hasAnyField = Object.values(extracted).some((v) => v != null);
  if (!hasAnyField) return null;

  return extracted;
}

export async function loadContextNode(
  state: SearchStateType,
  config: LangGraphRunnableConfig,
): Promise<Partial<SearchStateType>> {
  if (!hasConfigDeps(config)) {
    throw new AgentInvariantError(NODE.load_context, "Config deps required");
  }
  const { coreClient, normalizer } = config.configurable;

  if (state.intent === GRAPH_INTENT.startAdhoc) {
    const extracted = await extractAdhocContext(state.userResponse);
    const adhocContext = extracted ? await normalizer.normalizeAdhocContext(extracted, state.userId) : null;

    // Clear userResponse after extraction to prevent show_exploration
    // from interpreting initial message as user intent
    return { adhocContext, userResponse: "" };
  }

  const story = await coreClient.client.story.getStory.query({ userId: state.userId });
  const userContext = story.contexts.find((ctx) => ctx.nextContextId === null) ?? null;

  return { userContext };
}
