import { HumanMessage } from "@langchain/core/messages";
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
import { coldStartPhaseSchema, missingFieldSchema } from "../types.js";

import type { Trail, UserContext } from "../../../../shared/schemas.js";
import type { ExtractableContext } from "../../shared-tools/extraction-models.js";
import type { ColdStartState, ContextAgenda, MissingField } from "../types.js";
import type { BaseMessage } from "@langchain/core/messages";

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

function buildContextPrompt(messages: BaseMessage[], preview: string): string {
  const text = messages.map((m) => `${m.type}: ${m.content}`).join("\n");
  return `Extract career context for: "${preview}"

CONVERSATION:
${text}

═══════════════════════════════════════════════════
REQUIRED FIELDS (must extract):
═══════════════════════════════════════════════════
- position: Job title (e.g., "Backend Engineer", "Product Manager")
- domains: Work areas (e.g., ["Fintech", "B2B SaaS"]) - min 1
- skills: Technical/professional skills (e.g., ["TypeScript", "Python", "Leadership"]) - min 1
- industry: Company's industry (e.g., "Technology", "Banking", "E-commerce")
- companySize: Approximate size (e.g., "startup", "50-200", "1000+")
- countryCode: ISO 3166-1 alpha-2 code (e.g., "US", "DE", "RU")
- cityName: City name (e.g., "Berlin", "San Francisco")
- citizenships: Citizenship codes (e.g., ["RU", "DE"])
- birthYear: Year of birth (e.g., 1990)
- creationReason: Why this job started. Choose from:
  started_working, got_promoted, changed_position, changed_company,
  changed_industry, changed_domain, got_fired, burnout, relocation,
  education_upgrade, career_restart, management_transition, tech_shift

═══════════════════════════════════════════════════
OPTIONAL FIELDS (include if mentioned):
═══════════════════════════════════════════════════
- educationLevel: NONE, HIGH_SCHOOL, ASSOCIATE, BACHELOR, MASTER, DOCTORATE, PROFESSIONAL
- salaryExact: Exact annual salary in USD (OR use salaryMin/salaryMax for range)
- salaryMin/salaryMax: Salary range bounds in USD
- languages: ISO 639-1 codes for B2+ proficiency languages (e.g., ["en", "de"])
- feedback: Personal reflection on this transition (max 200 chars)

EXTRACTION RULES:
- If data not in conversation, make reasonable inference from context
- For first job, use creationReason: ["started_working"]
- Skills should be specific technologies or competencies, not generic`;
}

function buildTrailPrompt(messages: BaseMessage[], trailPreview: string): string {
  const text = messages.map((m) => `${m.type}: ${m.content}`).join("\n");
  return `Extract learning trail for: "${trailPreview}"

CONVERSATION:
${text}

═══════════════════════════════════════════════════
REQUIRED FIELDS (must extract):
═══════════════════════════════════════════════════
- skill: The main skill being developed (e.g., "React", "Python", "Machine Learning")
- platform: Where learning happened (e.g., "Coursera", "Udemy", "self-study", "bootcamp")

═══════════════════════════════════════════════════
OPTIONAL FIELDS (include if mentioned):
═══════════════════════════════════════════════════
- totalDurationWeeks: Learning duration in weeks
- schedule: { sessionsPerWeek: number, hoursPerSession: number }
- costUsd: Total cost in USD
- courseName: Specific course title
- courseLink: URL to the course
- ratingCourse: User's rating of the course (1-5)
- ratingPlatform: User's rating of the platform (1-5)
- ratingSchedule: User's rating of the schedule/format (1-5)
- userFeedback: Personal notes about the learning experience

EXTRACTION RULES:
- Trail describes learning/transition activities between career positions
- Focus on the specific learning activity mentioned in the preview`;
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
  const prompt = buildContextPrompt(messages, agenda.preview);
  const extracted: ExtractableContext = await contextExtractionModel.invoke([
    new HumanMessage(prompt),
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
  fromContextId: string | null,
  toContextId: string,
): Promise<Partial<Trail>> {
  const prompt = buildTrailPrompt(messages, trailPreview);
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
  if (agenda.incomingTrails.length === 0) return [];

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

type BatchContext = {
  agenda: ContextAgenda;
  contextIndex: number;
  clarificationRound: number;
  collectedContexts: UserContext[];
  collectedTrails: Trail[];
};

function determineOutcome(validation: ValidationResult, batchContext: BatchContext): ToolOutcome {
  const { agenda, contextIndex, clarificationRound, collectedContexts, collectedTrails } =
    batchContext;

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
  const updatedTrails = upsertTrailsForContext(
    collectedTrails,
    validation.trails,
    agenda.contextId,
  );

  return {
    type: "confirmation",
    updatedContexts,
    updatedTrails,
    contextIndex,
    preview: agenda.preview,
  };
}

function outcomeToCommand(outcome: ToolOutcome): Command {
  switch (outcome.type) {
    case "failed": {
      return new Command({
        update: { phase: coldStartPhaseSchema.Values.failed },
        goto: END,
      });
    }

    case "clarification": {
      return new Command({
        update: {
          phase: coldStartPhaseSchema.Values.awaiting_clarification,
          missingFields: outcome.missingFields,
          currentEntityContext: { contextIndex: outcome.contextIndex, preview: outcome.preview },
          clarificationRound: outcome.round,
        },
        goto: "ask_clarification",
      });
    }

    case "confirmation": {
      return new Command({
        update: {
          phase: coldStartPhaseSchema.Values.awaiting_context_confirmation,
          collectedContexts: outcome.updatedContexts,
          collectedTrails: outcome.updatedTrails,
          currentEntityContext: { contextIndex: outcome.contextIndex, preview: outcome.preview },
          clarificationRound: 0,
        },
        goto: "confirm_context",
      });
    }
  }
}

export const processEntityBatchTool = tool(
  async ({ contextIndex }: { contextIndex: number }, toolConfig: { state: ColdStartState }) => {
    const { messages, queue, clarificationRound, collectedContexts, collectedTrails } =
      toolConfig.state;

    const agenda = queue[contextIndex];
    if (!agenda) {
      console.error(`❌ Invalid contextIndex: ${contextIndex}, queue length: ${queue.length}`);
      return outcomeToCommand({ type: "failed" });
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
      return outcomeToCommand({ type: "failed" });
    }

    const validation = validateAndCollectMissing(contextData, trailsData, agenda);
    const batchContext: BatchContext = {
      agenda,
      contextIndex,
      clarificationRound,
      collectedContexts,
      collectedTrails,
    };

    const outcome = determineOutcome(validation, batchContext);
    return outcomeToCommand(outcome);
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
