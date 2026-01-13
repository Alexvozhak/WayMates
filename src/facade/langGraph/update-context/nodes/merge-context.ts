import { userContextSchema } from "../../../../../private/schemas.js";
import { config } from "../../../env.js";
import { extractMissingFields } from "../../cold-start-v2/nodes/validate-context.js";
import { PHASE } from "../state.js";

import type { UpdateContextStateType } from "../state.js";

const MAX_CLARIFICATION_ROUNDS = config.LANGCHAIN_MAX_CLARIFICATION_ROUNDS;

/**
 * Check if value is meaningful (not null, undefined, empty string, or empty array).
 */
function isMeaningfulValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (value === "") return false;
  if (Array.isArray(value) && value.length === 0) return false;
  return true;
}

/**
 * Check if extracted updates contain any non-null values.
 * Filters out empty strings and empty arrays that LLM might return instead of null.
 */
function hasNonNullValues(obj: Record<string, unknown>): boolean {
  return Object.values(obj).some((v) => isMeaningfulValue(v));
}

/**
 * Check if updates contain actual changes compared to current context.
 * Filters out empty values and compares remaining fields.
 */
function hasActualChanges(current: Record<string, unknown>, updates: Record<string, unknown>): boolean {
  for (const [key, value] of Object.entries(updates)) {
    if (!isMeaningfulValue(value)) continue;
    if (JSON.stringify(current[key]) !== JSON.stringify(value)) {
      return true;
    }
  }
  return false;
}

export function mergeContextNode(state: UpdateContextStateType): Partial<UpdateContextStateType> {
  const { currentContext, extractedUpdates } = state;

  if (!currentContext) {
    return { phase: PHASE.failed, validationErrors: ["No current context provided"] };
  }

  if (!extractedUpdates || !hasNonNullValues(extractedUpdates)) {
    return { phase: PHASE.failed, validationErrors: ["No updates extracted from message"] };
  }

  if (!hasActualChanges(currentContext, extractedUpdates)) {
    return { phase: PHASE.failed, validationErrors: ["No changes detected - extracted values match current context"] };
  }

  // Filter out null/empty values from extractedUpdates before merging
  // to prevent overwriting existing values with nulls
  const meaningfulUpdates = Object.fromEntries(
    Object.entries(extractedUpdates).filter(([, value]) => isMeaningfulValue(value)),
  );

  const merged = {
    ...currentContext,
    ...meaningfulUpdates,
    contextId: currentContext.contextId,
    previousContextId: currentContext.previousContextId,
    nextContextId: currentContext.nextContextId,
  };

  const result = userContextSchema.safeParse(merged);

  if (!result.success) {
    const missing = extractMissingFields(result, "Updated Context", "context");

    const nextRound = state.clarificationRound + 1;
    if (nextRound > MAX_CLARIFICATION_ROUNDS) {
      const errors = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
      return { phase: PHASE.failed, validationErrors: errors };
    }

    return {
      phase: PHASE.awaiting_clarification,
      missingFields: missing,
      clarificationRound: nextRound,
      validationErrors: [],
    };
  }

  return {
    mergedContext: result.data,
    validationErrors: [],
    missingFields: [],
    clarificationRound: 0,
    phase: PHASE.awaiting_confirmation,
  };
}
