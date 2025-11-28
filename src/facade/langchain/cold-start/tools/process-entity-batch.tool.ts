import { Command, END } from "@langchain/langgraph";
import { tool } from "langchain";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";

import { trailSchema, userContextSchema } from "../../../../shared/schemas.js";
import { config } from "../../../env.js";
import {
  contextExtractionModel,
  trailExtractionModel,
} from "../../shared-tools/extraction-models.js";
import { missingFieldSchema } from "../types.js";

import type { Trail, UserContext } from "../../../../shared/schemas.js";
import type { ExtractableContext } from "../../shared-tools/extraction-models.js";
import type { ColdStartState, ContextAgenda, MissingField } from "../types.js";
import type { BaseMessage } from "@langchain/core/messages";

const MAX_QUESTIONS_PER_BATCH = 5;

function buildContextPrompt(messages: BaseMessage[], preview: string): string {
  const text = messages.map((m) => `${m.getType()}: ${m.content}`).join("\n");
  return `Extract career context matching: "${preview}"

CONVERSATION:
${text}

Extract ALL fields for this specific position. Return null if not found.`;
}

function buildTrailPrompt(messages: BaseMessage[], trailPreview: string): string {
  const text = messages.map((m) => `${m.getType()}: ${m.content}`).join("\n");
  return `Extract learning trail matching: "${trailPreview}"

CONVERSATION:
${text}

Extract skill learned, platform used, duration if mentioned.`;
}

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
  const previous = queue[contextIndex - 1];
  const next = queue[contextIndex + 1];
  return {
    previousId: previous?.contextId ?? null,
    nextId: next?.contextId ?? null,
  };
}

async function extractContext(
  messages: BaseMessage[],
  agenda: ContextAgenda,
  queue: ContextAgenda[],
  contextIndex: number,
): Promise<Partial<UserContext>> {
  const prompt = buildContextPrompt(messages, agenda.preview);
  const extracted: ExtractableContext = await contextExtractionModel.invoke([
    { role: "user", content: prompt },
  ]);
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
  fromContextId: string,
  toContextId: string,
): Promise<Partial<Trail>> {
  const prompt = buildTrailPrompt(messages, trailPreview);
  const extracted = await trailExtractionModel.invoke([{ role: "user", content: prompt }]);

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
  if (agenda.incomingTrails.length === 0 || contextIndex === 0) return [];

  const previousContext = queue[contextIndex - 1];
  if (!previousContext) return [];

  const fromContextId = previousContext.contextId;
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

function validateAndCollectMissing(
  contextData: Partial<UserContext>,
  trailsData: Partial<Trail>[],
  agenda: ContextAgenda,
): { context: UserContext | null; trails: Trail[]; missing: MissingField[] } {
  const ctxValidation = userContextSchema.safeParse(contextData);
  const contextMissing = extractMissingFields(ctxValidation, agenda.preview, "context");

  const { validTrails, trailMissing } = validateTrails(trailsData, agenda);
  const allMissing = [...contextMissing, ...trailMissing].slice(0, MAX_QUESTIONS_PER_BATCH);

  return {
    context: ctxValidation.success ? ctxValidation.data : null,
    trails: validTrails,
    missing: allMissing,
  };
}

function buildClarificationCommand(
  missing: MissingField[],
  agenda: ContextAgenda,
  contextIndex: number,
  round: number,
): Command {
  return new Command({
    update: {
      phase: "awaiting_clarification" as const,
      missingFields: missing,
      currentEntityContext: { contextIndex, preview: agenda.preview },
      clarificationRound: round,
    },
    goto: "ask_clarification",
  });
}

function upsertContextAtIndex(
  existing: UserContext[],
  context: UserContext,
  index: number,
): UserContext[] {
  const updated = [...existing];
  if (index < updated.length) {
    updated[index] = context;
  } else {
    updated.push(context);
  }
  return updated;
}

function upsertTrailsForContext(
  existing: Trail[],
  newTrails: Trail[],
  toContextId: string,
): Trail[] {
  const filtered = existing.filter((t) => t.toContextId !== toContextId);
  return [...filtered, ...newTrails];
}

function buildConfirmationCommand(
  context: UserContext,
  trails: Trail[],
  agenda: ContextAgenda,
  contextIndex: number,
  existingContexts: UserContext[],
  existingTrails: Trail[],
): Command {
  const updatedContexts = upsertContextAtIndex(existingContexts, context, contextIndex);
  const updatedTrails = upsertTrailsForContext(existingTrails, trails, agenda.contextId);

  return new Command({
    update: {
      phase: "awaiting_context_confirmation" as const,
      collectedContexts: updatedContexts,
      collectedTrails: updatedTrails,
      currentEntityContext: { contextIndex, preview: agenda.preview },
      clarificationRound: 0,
    },
    goto: "confirm_context",
  });
}

function handleMissingFields(
  missing: MissingField[],
  agenda: ContextAgenda,
  contextIndex: number,
  clarificationRound: number,
): Command {
  const round = clarificationRound + 1;
  const maxRounds = config.LANGCHAIN_MAX_CLARIFICATION_ROUNDS;

  if (round > maxRounds) {
    return new Command({ update: { phase: "failed" as const }, goto: END });
  }
  return buildClarificationCommand(missing, agenda, contextIndex, round);
}

type ValidationResult = {
  context: UserContext | null;
  trails: Trail[];
  missing: MissingField[];
};

type BatchContext = {
  agenda: ContextAgenda;
  contextIndex: number;
  clarificationRound: number;
  collectedContexts: UserContext[];
  collectedTrails: Trail[];
};

function buildResultCommand(validation: ValidationResult, batchContext: BatchContext): Command {
  const { context, trails, missing } = validation;
  const { agenda, contextIndex, clarificationRound, collectedContexts, collectedTrails } =
    batchContext;

  if (missing.length > 0) {
    return handleMissingFields(missing, agenda, contextIndex, clarificationRound);
  }

  if (!context) {
    return new Command({ update: { phase: "failed" as const }, goto: END });
  }

  return buildConfirmationCommand(
    context,
    trails,
    agenda,
    contextIndex,
    collectedContexts,
    collectedTrails,
  );
}

export const processEntityBatchTool = tool(
  async ({ contextIndex }: { contextIndex: number }, toolConfig: { state: ColdStartState }) => {
    const { messages, queue, clarificationRound = 0 } = toolConfig.state;
    const { collectedContexts = [], collectedTrails = [] } = toolConfig.state;

    const agenda = queue?.[contextIndex];
    if (!queue || !agenda) {
      return new Command({ update: { phase: "failed" as const }, goto: END });
    }

    console.log(`🔧 process_entity_batch: context ${contextIndex + 1}/${queue.length}`);

    let contextData: Partial<UserContext>;
    let trailsData: Partial<Trail>[];

    try {
      [contextData, trailsData] = await Promise.all([
        extractContext(messages, agenda, queue, contextIndex),
        extractAllTrails(messages, agenda, queue, contextIndex),
      ]);
    } catch (error) {
      console.error("❌ Extraction failed:", error);
      return new Command({ update: { phase: "failed" as const }, goto: END });
    }

    const validation = validateAndCollectMissing(contextData, trailsData, agenda);
    const batchContext: BatchContext = {
      agenda,
      contextIndex,
      clarificationRound,
      collectedContexts,
      collectedTrails,
    };

    return buildResultCommand(validation, batchContext);
  },
  {
    name: "process_entity_batch",
    description:
      "Process ONE context + ALL its incoming trails. " +
      "Extracts, validates, returns Command with phase update.",
    schema: z.object({
      contextIndex: z.number().describe("Index in queue (0-based)"),
    }),
  },
);
