import { HumanMessage } from "@langchain/core/messages";
import { v7 as uuidv7 } from "uuid";

import { contextExtractionPrompt, trailExtractionPrompt } from "../../cold-start/prompts.js";
import { extractableContextSchema, extractableTrailSchema } from "../../shared-tools/extraction-models.js";
import { getModel } from "../../shared-tools/models.js";
import { PHASE } from "../state.js";

import type { ExtractableContext } from "../../shared-tools/extraction-models.js";
import type { ColdStartStateType, ContextAgenda, Trail, UserContext } from "../state.js";
import type { BaseMessage } from "@langchain/core/messages";

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
): Promise<Partial<Trail>[]> {
  if (agenda.incomingTrails.length === 0) {
    return [];
  }

  const fromContextId = contextIndex > 0 ? (queue[contextIndex - 1]?.contextId ?? null) : null;
  const toContextId = agenda.contextId;

  const trailPromises = agenda.incomingTrails.map(async (trailPreview) => {
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
): Promise<Partial<UserContext>> {
  const prompt = contextExtractionPrompt(messages, agenda.preview);
  const extracted: ExtractableContext = await contextExtractionModel.invoke([new HumanMessage(prompt)]);
  const { previousId, nextId } = getLinkedContextIds(queue, contextIndex);

  return {
    ...extracted,
    contextId: agenda.contextId,
    previousContextId: previousId,
    nextContextId: nextId,
    createdAt: new Date().toISOString(),
  };
}

export async function extractContextNode(state: ColdStartStateType): Promise<Partial<ColdStartStateType>> {
  const { messages, queue, currentContextIndex } = state;

  const agenda = queue[currentContextIndex];
  if (!agenda) {
    return {
      phase: PHASE.failed,
    };
  }

  const [contextData, trailsData] = await Promise.all([
    extractContextData(messages, agenda, queue, currentContextIndex),
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

export { extractAllTrails, extractContextData };
