import { HumanMessage, ToolMessage } from "@langchain/core/messages";
import { Command } from "@langchain/langgraph";
import { tool } from "langchain";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";

import { trailSchema, userContextSchema } from "../../../../shared/schemas.js";
import { config } from "../../../env.js";
import { extractableContextSchema, extractableTrailSchema } from "../../shared-tools/extraction-models.js";
import { getModel } from "../../shared-tools/models.js";
import { contextExtractionPrompt, trailExtractionPrompt } from "../prompts.js";
import { missingFieldSchema, PHASE } from "../types.js";
import { TOOL_NAME } from "../workflow-constants.js";

import type { Trail, UserContext } from "../../../../shared/schemas.js";
import type { ExtractableContext } from "../../shared-tools/extraction-models.js";
import type { ColdStartState, ContextAgenda, MissingField } from "../types.js";
import type { BaseMessage } from "@langchain/core/messages";
import type { ToolRuntime } from "@langchain/core/tools";

const contextExtractionModel = getModel("extraction").withStructuredOutput(extractableContextSchema);
const trailExtractionModel = getModel("extraction").withStructuredOutput(extractableTrailSchema);

const MAX_QUESTIONS_PER_BATCH = config.LANGCHAIN_MAX_QUESTIONS_PER_BATCH;

type ToolOutcome =
  | {
      type: "clarification";
      missingFields: MissingField[];
      round: number;
      contextIndex: number;
      preview: string;
    }
  | {
      type: "confirmation";
      updatedContexts: UserContext[];
      updatedTrails: Trail[];
      contextIndex: number;
      preview: string;
    }
  | { type: "failed" };

function extractMissingFields<T>(
  validation: z.SafeParseReturnType<unknown, T>,
  entityLabel: string,
  entityType: "context" | "trail",
): MissingField[] {
  if (validation.success) return [];

  const fields: MissingField[] = [];
  const seen = new Set<string>();

  for (const err of validation.error.errors) {
    const field = err.path.join(".");
    if (seen.has(field) || fields.length >= MAX_QUESTIONS_PER_BATCH) continue;
    seen.add(field);

    fields.push(
      missingFieldSchema.parse({
        field,
        entityLabel,
        entityType,
        zodMessage: err.message,
      }),
    );
  }

  return fields;
}

function getLinkedContextIds(
  queue: ContextAgenda[],
  contextIndex: number,
): { previousId: string | null; nextId: string | null } {
  return {
    previousId: queue[contextIndex - 1]?.contextId ?? null,
    nextId: queue[contextIndex + 1]?.contextId ?? null,
  };
}

async function extractContext(
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

async function extractTrail(
  messages: BaseMessage[],
  trailPreview: string,
  fromContextId: string | null,
  toContextId: string,
): Promise<Partial<Trail>> {
  const prompt = trailExtractionPrompt(messages, trailPreview);
  const extracted = await trailExtractionModel.invoke([new HumanMessage(prompt)]);

  return {
    ...extracted,
    trailId: `trl_${uuidv7()}`,
    fromContextId,
    toContextId,
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

  const trailPromises = agenda.incomingTrails.map((preview) =>
    extractTrail(messages, preview, fromContextId, toContextId),
  );

  return Promise.all(trailPromises);
}

function validateTrails(
  trailsData: Partial<Trail>[],
  agenda: ContextAgenda,
): { validTrails: Trail[]; trailMissing: MissingField[] } {
  const validTrails: Trail[] = [];
  const trailMissing: MissingField[] = [];

  for (const [index, trailData] of trailsData.entries()) {
    const trailValidation = trailSchema.safeParse(trailData);
    const label = agenda.incomingTrails[index] ?? `Trail ${index + 1}`;

    if (trailValidation.success) {
      validTrails.push(trailValidation.data);
    } else {
      trailMissing.push(...extractMissingFields(trailValidation, label, "trail"));
    }
  }

  return { validTrails, trailMissing };
}

type ValidationSuccess = { success: true; context: UserContext; trails: Trail[] };
type ValidationFailure = { success: false; missing: MissingField[] };
type ValidationResult = ValidationSuccess | ValidationFailure;

function validateAndCollectMissing(
  contextData: Partial<UserContext>,
  trailsData: Partial<Trail>[],
  agenda: ContextAgenda,
): ValidationResult {
  const ctxValidation = userContextSchema.safeParse(contextData);
  const contextMissing = extractMissingFields(ctxValidation, agenda.preview, "context");

  const { validTrails, trailMissing } = validateTrails(trailsData, agenda);
  const allMissing = [...contextMissing, ...trailMissing].slice(0, MAX_QUESTIONS_PER_BATCH);

  if (allMissing.length > 0 || !ctxValidation.success) {
    return { success: false, missing: allMissing };
  }

  return { success: true, context: ctxValidation.data, trails: validTrails };
}

function upsertContextAtIndex(existing: UserContext[], context: UserContext, index: number): UserContext[] {
  const updated = [...existing];
  if (index < updated.length) {
    updated[index] = context;
  } else {
    updated.push(context);
  }
  return updated;
}

function upsertTrailsForContext(existing: Trail[], newTrails: Trail[], toContextId: string): Trail[] {
  const filtered = existing.filter((t) => t.toContextId !== toContextId);
  return [...filtered, ...newTrails];
}

function determineOutcome(
  validation: ValidationResult,
  agenda: ContextAgenda,
  contextIndex: number,
  clarificationRound: number,
  collectedContexts: UserContext[],
  collectedTrails: Trail[],
): ToolOutcome {
  if (!validation.success) {
    const nextRound = clarificationRound + 1;
    if (nextRound > config.LANGCHAIN_MAX_CLARIFICATION_ROUNDS) {
      return { type: "failed" };
    }
    return {
      type: "clarification",
      missingFields: validation.missing,
      round: nextRound,
      contextIndex,
      preview: agenda.preview,
    };
  }

  const updatedContexts = upsertContextAtIndex(collectedContexts, validation.context, contextIndex);
  const updatedTrails = upsertTrailsForContext(collectedTrails, validation.trails, agenda.contextId);

  return {
    type: "confirmation",
    updatedContexts,
    updatedTrails,
    contextIndex,
    preview: agenda.preview,
  };
}

function outcomeToCommand(outcome: ToolOutcome, toolCallId: string): Command {
  switch (outcome.type) {
    case "failed": {
      return new Command({
        update: {
          phase: PHASE.failed,
          /* eslint-disable @typescript-eslint/naming-convention -- LangChain API */
          messages: [
            new ToolMessage({
              content: "Failed: max clarification rounds exceeded",
              tool_call_id: toolCallId,
            }),
          ],
          /* eslint-enable @typescript-eslint/naming-convention */
        },
      });
    }

    case "clarification": {
      const fieldsInfo = outcome.missingFields.map((f) => f.field).join(", ");
      return new Command({
        update: {
          phase: PHASE.awaiting_clarification,
          missingFields: outcome.missingFields,
          currentEntityContext: { contextIndex: outcome.contextIndex, preview: outcome.preview },
          clarificationRound: outcome.round,
          /* eslint-disable @typescript-eslint/naming-convention -- LangChain API */
          messages: [
            new ToolMessage({
              content: `Need clarification for "${outcome.preview}": missing ${fieldsInfo}. Now call ${TOOL_NAME.ask_clarification} to get user input.`,
              tool_call_id: toolCallId,
            }),
          ],
          /* eslint-enable @typescript-eslint/naming-convention */
        },
      });
    }

    case "confirmation": {
      return new Command({
        update: {
          phase: PHASE.awaiting_context_confirmation,
          collectedContexts: outcome.updatedContexts,
          collectedTrails: outcome.updatedTrails,
          currentEntityContext: { contextIndex: outcome.contextIndex, preview: outcome.preview },
          clarificationRound: 0,
          /* eslint-disable @typescript-eslint/naming-convention -- LangChain API */
          messages: [
            new ToolMessage({
              content:
                `✅ EXTRACTION COMPLETE for "${outcome.preview}". ` +
                `Now call ${TOOL_NAME.show_context} to present to user and wait for approval.`,
              tool_call_id: toolCallId,
            }),
          ],
          /* eslint-enable @typescript-eslint/naming-convention */
        },
      });
    }
  }
}

export const processEntityBatchTool = tool(
  async ({ contextIndex }: { contextIndex: number }, runtime: ToolRuntime<ColdStartState>) => {
    const { state, toolCallId } = runtime;
    // Note: Defaults needed because checkpoint may not have these fields on first run
    const { messages, queue, clarificationRound = 0, collectedContexts = [], collectedTrails = [] } = state;

    const agenda = queue[contextIndex];
    if (!agenda) {
      return outcomeToCommand({ type: "failed" }, toolCallId);
    }

    let contextData: Partial<UserContext>;
    let trailsData: Partial<Trail>[];

    try {
      [contextData, trailsData] = await Promise.all([
        extractContext(messages, agenda, queue, contextIndex),
        extractAllTrails(messages, agenda, queue, contextIndex),
      ]);
    } catch {
      return outcomeToCommand({ type: "failed" }, toolCallId);
    }

    const validation = validateAndCollectMissing(contextData, trailsData, agenda);

    const outcome = determineOutcome(
      validation,
      agenda,
      contextIndex,
      clarificationRound,
      collectedContexts,
      collectedTrails,
    );
    return outcomeToCommand(outcome, toolCallId);
  },
  {
    name: TOOL_NAME.process_entity_batch,
    description:
      `Process ONE context + ALL its incoming trails. ` +
      `AFTER success: call ${TOOL_NAME.show_context} to present to user. ` +
      `Only call ${TOOL_NAME.process_entity_batch} again after user confirms via ${TOOL_NAME.confirm_context}.`,
    schema: z.object({
      contextIndex: z.number().describe("Index in queue (0-based)"),
    }),
  },
);
