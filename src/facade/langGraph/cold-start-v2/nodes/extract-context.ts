import { HumanMessage } from "@langchain/core/messages";
import { v7 as uuidv7 } from "uuid";

import { AgentInvariantError } from "../../../errors.js";
import { logger } from "../../../logger.js";
import { withReasoning } from "../../../utils/llm-schemas.js";
import { extractableContextSchema, extractableTrailSchema } from "../../shared-tools/extraction-models.js";
import { getModel } from "../../shared-tools/models.js";
import { contextExtractionPrompt, trailExtractionPrompt } from "../prompts.js";
import { NODE } from "../types.js";
import { withLogging } from "../with-logging.js";

import type { ContextId } from "../../../../shared/schemas.js";
import type { ExtractableContext, ExtractableTrail } from "../../shared-tools/extraction-models.js";
import type { ColdStartStateType, ContextAgenda } from "../state.js";
import type { BaseMessage } from "@langchain/core/messages";

const contextExtractionModel = getModel("extraction").withStructuredOutput(
  withReasoning(extractableContextSchema, "Explain what career context you extracted and why")
);
const trailExtractionModel = getModel("extraction").withStructuredOutput(
  withReasoning(extractableTrailSchema, "Explain what trail/certification you extracted and why")
);

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
    const { reasoning, ...extracted } = await trailExtractionModel.invoke([new HumanMessage(prompt)]);
    logger.info({ reasoning }, "trail extraction reasoning");

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
  const { reasoning, ...extracted } = await contextExtractionModel.invoke([new HumanMessage(prompt)]);
  logger.info({ reasoning }, "context extraction reasoning");
  const { previousId, nextId } = getLinkedContextIds(queue, contextIndex);

  return {
    ...extracted,
    contextId: agenda.contextId,
    previousContextId: previousId,
    nextContextId: nextId,
    createdAt: new Date().toISOString(),
  };
}

export const extractContextNode = withLogging<ColdStartStateType>(
  NODE.extract_context,
  async (state, _config, { dictionariesService }) => {
    const { messages, queue, currentContextIndex, cvText } = state;

    const agenda = queue[currentContextIndex];
    if (!agenda) {
      throw new AgentInvariantError(NODE.extract_context, "agenda must exist for currentContextIndex", {
        currentContextIndex,
        queueLength: queue.length,
      });
    }

    const dictHints = await dictionariesService.buildHints([
      "role",
      "position",
      "domain",
      "skill",
      "industry",
      "reasons",
    ]);

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
  },
);
