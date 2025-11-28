import { MessagesZodState } from "@langchain/langgraph";
import { z } from "zod";

import {
  contextIdSchema,
  trailSchema,
  userContextSchema,
  userIdSchema,
} from "../../../shared/schemas.js";

/**
 * 8 phases for cold_start multi-context workflow.
 * Source of Truth: HANDOFF-cold-start-refactoring.md
 *
 * Note: "planning" and "sequential_collection" were removed as they are
 * implicit states during tool execution, not explicit phase transitions.
 */
export const coldStartPhaseSchema = z.enum([
  "story_gathering",
  "awaiting_plan_confirmation",
  "awaiting_clarification",
  "awaiting_context_confirmation",
  "awaiting_final_confirmation",
  "saved",
  "already_saved",
  "failed",
]);

export type ColdStartPhase = z.infer<typeof coldStartPhaseSchema>;

/**
 * Base schema for context agenda (what LLM returns during planning).
 * Used by planCareerHistoryTool's structured output.
 */
export const contextAgendaBaseSchema = z.object({
  preview: z.string().describe("Human-readable preview: 'Junior Backend в Яндексе 2020-2022'"),
  incomingTrails: z
    .array(z.string())
    .describe("Array of trail preview strings: ['Coursera React course 2022']"),
});

export type ContextAgendaBase = z.infer<typeof contextAgendaBaseSchema>;

/**
 * Queue item with context ID generated upfront (in planning phase).
 * Extends base schema with server-generated contextId.
 */
export const contextAgendaSchema = contextAgendaBaseSchema.extend({
  contextId: contextIdSchema.describe("UUID v7 generated in planning phase"),
});

export type ContextAgenda = z.infer<typeof contextAgendaSchema>;

/**
 * Structured validation error for clarification workflow.
 * Generic helper extracts these from ANY Zod schema.
 */
export const missingFieldSchema = z.object({
  field: z.string().describe("Field name that failed validation"),
  entityLabel: z.string().describe("Human-readable entity label: 'Backend Engineer at Google'"),
  entityType: z.enum(["context", "trail"]).describe("Which entity type this field belongs to"),
  zodMessage: z.string().describe("Zod error message"),
});

export type MissingField = z.infer<typeof missingFieldSchema>;

/**
 * Current entity context for clarification/confirmation interrupts.
 * Provides context about which entity is being processed.
 */
export const currentEntityContextSchema = z.object({
  contextIndex: z.number().describe("Index in queue (0-based)"),
  preview: z.string().describe("Preview string for the current context"),
});

export type CurrentEntityContext = z.infer<typeof currentEntityContextSchema>;

/**
 * Progress indicator for multi-context collection.
 */
export const collectionProgressSchema = z.object({
  current: z.number().describe("Current context number (1-based for display)"),
  total: z.number().describe("Total contexts in queue"),
});

export type CollectionProgress = z.infer<typeof collectionProgressSchema>;

/**
 * Cold Start agent state schema.
 * Source of Truth: HANDOFF-cold-start-refactoring.md
 *
 * Key design decisions:
 * - Context IDs generated upfront in planning (solves forward references)
 * - No EntityStatus - agent phase = single source of truth
 * - No currentTrailIndex - batch processes ALL trails per context
 * - Progress tracked via currentEntityContext.contextIndex
 */
export const coldStartStateSchema = z.object({
  messages: MessagesZodState.shape.messages,

  phase: coldStartPhaseSchema.default("story_gathering"),

  queue: z.array(contextAgendaSchema).default([]),

  collectedContexts: z.array(userContextSchema).default([]),
  collectedTrails: z.array(trailSchema).default([]),

  missingFields: z.array(missingFieldSchema).default([]),
  clarificationRound: z.number().default(0),

  currentEntityContext: currentEntityContextSchema.optional(),

  userId: z.string(),
});

export type ColdStartState = z.infer<typeof coldStartStateSchema>;

/**
 * Result of processEntityBatchTool execution.
 * Discriminated union by phase for type-safe handling.
 */
export const entityBatchResultClarificationSchema = z.object({
  phase: z.literal("awaiting_clarification"),
  missingFields: z.array(missingFieldSchema),
  currentEntityContext: currentEntityContextSchema,
});

export const entityBatchResultConfirmationSchema = z.object({
  phase: z.literal("awaiting_context_confirmation"),
  entity: userContextSchema,
  relatedTrails: z.array(trailSchema),
  progress: collectionProgressSchema,
});

export const entityBatchResultSchema = z.discriminatedUnion("phase", [
  entityBatchResultClarificationSchema,
  entityBatchResultConfirmationSchema,
]);

export type EntityBatchResultClarification = z.infer<typeof entityBatchResultClarificationSchema>;
export type EntityBatchResultConfirmation = z.infer<typeof entityBatchResultConfirmationSchema>;
export type EntityBatchResult = z.infer<typeof entityBatchResultSchema>;

/**
 * Result of planCareerHistoryTool execution.
 */
export const planResultSchema = z.object({
  phase: z.literal("awaiting_plan_confirmation"),
  queue: z.array(contextAgendaSchema),
});

export type PlanResult = z.infer<typeof planResultSchema>;

/**
 * Final preview result for awaiting_final_confirmation phase.
 */
export const finalPreviewSchema = z.object({
  phase: z.literal("awaiting_final_confirmation"),
  preview: z.object({
    contexts: z.array(userContextSchema),
    trails: z.array(trailSchema),
  }),
  summary: z.object({
    contextsCount: z.number(),
    trailsCount: z.number(),
  }),
});

export type FinalPreview = z.infer<typeof finalPreviewSchema>;

/**
 * Collected story data (contexts + trails + userId).
 * Matches StoryInput structure from shared/schemas.
 */
export const collectedStorySchema = z.object({
  userId: userIdSchema,
  contexts: z.array(userContextSchema),
  trails: z.array(trailSchema),
});

export type CollectedStory = z.infer<typeof collectedStorySchema>;

/**
 * Saved result after successful collection.
 * MCP handler calls Core upsertStory.
 */
export const savedResultSchema = z
  .object({
    phase: z.literal("saved"),
  })
  .merge(collectedStorySchema);

export type SavedResult = z.infer<typeof savedResultSchema>;

/**
 * Already saved result (idempotency protection).
 */
export const alreadySavedResultSchema = z.object({
  phase: z.literal("already_saved"),
  message: z.string(),
});

export type AlreadySavedResult = z.infer<typeof alreadySavedResultSchema>;

/**
 * Cold Start facade response - discriminated union by phase.
 * This is what MCP handler returns to LibreChat.
 */
export const coldStartResponseSchema = z.discriminatedUnion("phase", [
  z.object({
    phase: z.literal("story_gathering"),
    message: z.string(),
  }),
  planResultSchema,
  entityBatchResultClarificationSchema,
  entityBatchResultConfirmationSchema,
  finalPreviewSchema,
  savedResultSchema,
  alreadySavedResultSchema,
  z.object({
    phase: z.literal("failed"),
    message: z.string(),
  }),
]);

export type ColdStartResponse = z.infer<typeof coldStartResponseSchema>;
