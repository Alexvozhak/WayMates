import { HumanMessage } from "@langchain/core/messages";
import { v7 as uuidv7 } from "uuid";

import { AgentInvariantError } from "../../../errors.js";
import { buildDictionaryHints, loadExtractionDicts } from "../../shared/dictionary-hints.js";
import { hasConfigDeps } from "../../shared/types.js";
import { extractableContextSchema, extractableTrailSchema } from "../../shared-tools/extraction-models.js";
import { getModel } from "../../shared-tools/models.js";
import { contextExtractionPrompt, trailExtractionPrompt } from "../prompts.js";

import type { ContextId } from "../../../../shared/schemas.js";
import type { ExtractableContext, ExtractableTrail } from "../../shared-tools/extraction-models.js";
import type { ColdStartStateType, ContextAgenda } from "../state.js";
import type { BaseMessage } from "@langchain/core/messages";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";

const contextExtractionModel = getModel("extraction").withStructuredOutput(extractableContextSchema);
const trailExtractionModel = getModel("extraction").withStructuredOutput(extractableTrailSchema);

function getLinkedContextIds(
  queue: ContextAgenda[],
  contextIndex: number,
): { previousId: string | null; nextId: string | null } {
  return {
    previousId: queue[contextIndex - 1]?.contextId ?? null,
    nextId: queue[contextIndex + 1]?.contextId ?? null,
  };
}

async function extractAllTrails(
  messages: BaseMessage[],
  agenda: ContextAgenda,
  queue: ContextAgenda[],
  contextIndex: number,
): Promise<ExtractableTrail[]> {
  if (agenda.incomingTrails.length === 0) {
    return [];
  }

  const fromContextId: ContextId | null = contextIndex > 0 ? (queue[contextIndex - 1]?.contextId ?? null) : null;
  const toContextId: ContextId = agenda.contextId;

  const trailPromises = agenda.incomingTrails.map(async (trailPreview): Promise<ExtractableTrail> => {
    const prompt = trailExtractionPrompt(messages, trailPreview);
    const extracted = await trailExtractionModel.invoke([new HumanMessage(prompt)]);

    return {
      ...extracted,
      trailId: `trl_${uuidv7()}`,
      fromContextId,
      toContextId,
    };
  });

  return Promise.all(trailPromises);
}

async function extractContextData(
  messages: BaseMessage[],
  agenda: ContextAgenda,
  queue: ContextAgenda[],
  contextIndex: number,
  cvText: string | null,
  dictHints: string,
): Promise<ExtractableContext> {
  const prompt = contextExtractionPrompt(messages, agenda.preview, cvText, dictHints);
  const extracted = await contextExtractionModel.invoke([new HumanMessage(prompt)]);
  const { previousId, nextId } = getLinkedContextIds(queue, contextIndex);

  return {
    ...extracted,
    contextId: agenda.contextId,
    previousContextId: previousId,
    nextContextId: nextId,
    createdAt: new Date().toISOString(),
  };
}

export async function extractContextNode(
  state: ColdStartStateType,
  config: LangGraphRunnableConfig,
): Promise<Partial<ColdStartStateType>> {
  const { messages, queue, currentContextIndex, cvText } = state;

  const agenda = queue[currentContextIndex];
  if (!agenda) {
    throw new AgentInvariantError("extractContextNode", "agenda must exist for currentContextIndex", {
      currentContextIndex,
      queueLength: queue.length,
    });
  }

  // Load dictionaries for better extraction
  let dictHints = "";
  if (hasConfigDeps(config)) {
    const dicts = await loadExtractionDicts(config.configurable.cache);
    dictHints = buildDictionaryHints(dicts);
  }

  const [contextData, trailsData] = await Promise.all([
    extractContextData(messages, agenda, queue, currentContextIndex, cvText, dictHints),
    extractAllTrails(messages, agenda, queue, currentContextIndex),
  ]);

  return {
    pendingContext: contextData,
    pendingTrails: trailsData,
    currentEntityContext: {
      contextIndex: currentContextIndex,
      preview: agenda.preview,
    },
  };
}
