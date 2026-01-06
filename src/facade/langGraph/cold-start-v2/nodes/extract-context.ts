import { HumanMessage } from "@langchain/core/messages";
import { v7 as uuidv7 } from "uuid";

import { AgentInvariantError } from "../../../errors.js";
import { logger } from "../../../logger.js";
import { withReasoning } from "../../../utils/llm-schemas.js";
import { extractableContextSchema, extractableTrailSchema } from "../../shared-tools/extraction-models.js";
import { getModel } from "../../shared-tools/models.js";
import { contextClarificationPrompt, contextExtractionPrompt, trailExtractionPrompt } from "../prompts.js";
import { NODE } from "../types.js";
import { withLogging } from "../with-logging.js";

import type { ContextId } from "../../../../shared/schemas.js";
import type { ExtractableContext, ExtractableTrail } from "../../shared-tools/extraction-models.js";
import type { ColdStartStateType, ContextAgenda } from "../state.js";
import type { BaseMessage } from "@langchain/core/messages";

const contextExtractionModel = getModel("extraction").withStructuredOutput(
  withReasoning(extractableContextSchema, "Explain what career context you extracted and why"),
);
const trailExtractionModel = getModel("extraction").withStructuredOutput(
  withReasoning(extractableTrailSchema, "Explain what trail/certification you extracted and why"),
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
    // Use extracted createdAt (from preview period), fallback to now if LLM didn't extract
    createdAt: extracted.createdAt ?? new Date().toISOString(),
  };
}

function dedupeArray<T>(arr: T[] | null | undefined): T[] | null {
  if (!arr || arr.length === 0) return arr ?? null;
  return [...new Set(arr)];
}

async function clarifyContext(
  pending: ExtractableContext,
  missingFieldNames: string[],
  userResponse: string,
  dictHints: string,
): Promise<ExtractableContext> {
  const prompt = contextClarificationPrompt(pending, missingFieldNames, userResponse, dictHints);
  const { reasoning, ...merged } = await contextExtractionModel.invoke([new HumanMessage(prompt)]);
  logger.info({ reasoning, missingFieldNames }, "context clarification reasoning");

  return {
    ...merged,
    contextId: pending.contextId,
    previousContextId: pending.previousContextId,
    nextContextId: pending.nextContextId,
    createdAt: merged.createdAt ?? pending.createdAt,
    // Dedupe arrays in case LLM duplicated values during merge
    skills: dedupeArray(merged.skills),
    domains: dedupeArray(merged.domains) ?? [],
    citizenships: dedupeArray(merged.citizenships),
    languages: dedupeArray(merged.languages),
    creationReason: dedupeArray(merged.creationReason) ?? [],
  };
}

/* eslint-disable complexity -- unified clarification for missingFields + suggestions */
export const extractContextNode = withLogging<ColdStartStateType>(
  NODE.extract_context,
  async (state, _config, { dictionariesService }) => {
    const {
      messages,
      queue,
      currentContextIndex,
      cvText,
      pendingContext,
      missingFields,
      rolePositionSuggestions,
      collectedContexts,
      userResponse,
    } = state;

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
      "education_level",
      "reasons",
    ]);

    // Determine base context for clarification (unified for missingFields and suggestions)
    const existingCollected = collectedContexts[currentContextIndex];
    const baseContext = pendingContext ?? existingCollected ?? null;
    const clarifyFields =
      missingFields.length > 0 ? missingFields.map((f) => f.field) : rolePositionSuggestions.map((s) => s.field);
    const needsClarification = baseContext && clarifyFields.length > 0 && userResponse;

    const contextData = needsClarification
      ? await clarifyContext(baseContext, clarifyFields, userResponse, dictHints)
      : await extractContextData(messages, agenda, queue, currentContextIndex, cvText, dictHints);

    // Only extract trails on fresh extraction (not during clarification)
    const trailsData = needsClarification
      ? state.pendingTrails
      : await extractAllTrails(messages, agenda, queue, currentContextIndex);

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
/* eslint-enable complexity */
