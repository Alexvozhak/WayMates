import {
  CONTEXT_OPTIONAL_FIELDS,
  missingFieldSchema,
  // FROZEN: trailSchema unused while trails disabled
  userContextSchema,
} from "../../../../shared/schemas.js";
import { config } from "../../../env.js";
import { AgentInvariantError } from "../../../errors.js";
import { hasValue } from "../../shared/state-utils.js";
import { NODE, PHASE } from "../types.js";
import { withLogging } from "../with-logging.js";

import type { ContextOptionalField, UserId } from "../../../../shared/schemas.js";
import type { Normalizer, RolePositionSuggestion } from "../../../services/normalizer.js";
import type { ExtractableContext, ExtractableTrail } from "../../shared-tools/extraction-models.js";
import type { ColdStartStateType, ContextAgenda, MissingField, Trail, UserContext } from "../state.js";
import type { NormalizationEntry } from "../types.js";
import type { z } from "zod";

const MAX_QUESTIONS_PER_BATCH = config.LANGCHAIN_MAX_QUESTIONS_PER_BATCH;
const MAX_CLARIFICATION_ROUNDS = config.LANGCHAIN_MAX_CLARIFICATION_ROUNDS;

function getUnfilledOptionalFields(ctx: Record<string, unknown>): ContextOptionalField[] {
  return CONTEXT_OPTIONAL_FIELDS.filter((f) => !hasValue(ctx[f]));
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

// FROZEN: Trail validation disabled
// function validateTrails(
//   trailsData: ExtractableTrail[],
//   agenda: ContextAgenda,
// ): { validTrails: Trail[]; trailMissing: MissingField[] } {
//   const validTrails: Trail[] = [];
//   const trailMissing: MissingField[] = [];
//
//   for (const [index, trailData] of trailsData.entries()) {
//     const trailValidation = trailSchema.safeParse(trailData);
//     const label = agenda.incomingTrails[index] ?? `Trail ${index + 1}`;
//
//     if (trailValidation.success) {
//       validTrails.push(trailValidation.data);
//     } else {
//       trailMissing.push(...extractMissingFields(trailValidation, label, "trail"));
//     }
//   }
//
//   return { validTrails, trailMissing };
// }

type ValidationSuccess = { success: true; context: UserContext; trails: Trail[] };
type ValidationFailure = { success: false; missing: MissingField[] };
type ValidationResult = ValidationSuccess | ValidationFailure;

function validateAndCollectMissing(
  contextData: ExtractableContext,
  _trailsData: ExtractableTrail[], // FROZEN: trails disabled
  agenda: ContextAgenda,
): ValidationResult {
  const ctxValidation = userContextSchema.safeParse(contextData);
  const contextMissing = extractMissingFields(ctxValidation, agenda.preview, "context");

  // FROZEN: Trail validation disabled — trails always empty
  const allMissing = contextMissing.slice(0, MAX_QUESTIONS_PER_BATCH);

  if (allMissing.length > 0 || !ctxValidation.success) {
    return { success: false, missing: allMissing };
  }

  return { success: true, context: ctxValidation.data, trails: [] };
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

type NormalizationResult = {
  normalizedContext: UserContext;
  normalizations: NormalizationEntry[];
  rolePositionSuggestions: RolePositionSuggestion[];
};

function collectDomainsDiff(originalDomains: string[], normalizedDomains: string[]): NormalizationEntry[] {
  const entries: NormalizationEntry[] = [];

  for (const [i, original] of originalDomains.entries()) {
    const normalized = normalizedDomains[i];

    if (original && normalized && original !== normalized) {
      entries.push({ field: "domain", original, normalized });
    }
  }

  return entries;
}

async function normalizeAndCollectDiff(
  context: UserContext,
  userId: UserId,
  normalizer: Normalizer,
): Promise<NormalizationResult> {
  const normalizations: NormalizationEntry[] = [];
  const rolePositionSuggestions: RolePositionSuggestion[] = [];

  // Normalize role/position with suggestions support
  const [roleResult, positionResult] = await Promise.all([
    normalizer.normalizeTermWithResult("role", context.role, userId),
    normalizer.normalizeTermWithResult("position", context.position, userId),
  ]);

  let role = context.role;
  let position = context.position;

  if (roleResult.status === "suggestions") {
    rolePositionSuggestions.push(roleResult);
  } else if (roleResult.value !== context.role) {
    normalizations.push({ field: "role", original: context.role, normalized: roleResult.value });
    role = roleResult.value;
  }

  if (positionResult.status === "suggestions") {
    rolePositionSuggestions.push(positionResult);
  } else if (positionResult.value !== context.position) {
    normalizations.push({ field: "position", original: context.position, normalized: positionResult.value });
    position = positionResult.value;
  }

  // Normalize other fields (open dictionaries — always success)
  const normalizedContext = await normalizer.normalizeFullContext({ ...context, role, position }, userId);

  // Collect diffs for industry/domains
  if (context.industry !== normalizedContext.industry) {
    normalizations.push({ field: "industry", original: context.industry, normalized: normalizedContext.industry });
  }
  normalizations.push(...collectDomainsDiff(context.domains, normalizedContext.domains));

  return { normalizedContext, normalizations, rolePositionSuggestions };
}

export const validateContextNode = withLogging<ColdStartStateType>(
  NODE.validate_context,
  async (state, _config, { normalizerService }) => {
    const {
      pendingContext,
      pendingTrails,
      currentContextIndex,
      queue,
      clarificationRound,
      collectedContexts,
      collectedTrails,
      userId,
    } = state;

    const agenda = queue[currentContextIndex];
    if (!agenda) {
      throw new AgentInvariantError("validateContextNode", "agenda must exist for currentContextIndex", {
        currentContextIndex,
        queueLength: queue.length,
      });
    }

    if (!pendingContext) {
      throw new AgentInvariantError("validateContextNode", "pendingContext must exist after extraction");
    }

    const validation = validateAndCollectMissing(pendingContext, pendingTrails, agenda);

    if (!validation.success) {
      const nextRound = clarificationRound + 1;
      if (nextRound > MAX_CLARIFICATION_ROUNDS) {
        return { phase: PHASE.failed };
      }

      return {
        phase: PHASE.awaiting_clarification,
        missingFields: validation.missing,
        optionalFields: getUnfilledOptionalFields(pendingContext),
        clarificationRound: nextRound,
      };
    }

    const { normalizedContext, normalizations, rolePositionSuggestions } = await normalizeAndCollectDiff(
      validation.context,
      userId,
      normalizerService,
    );

    const updatedContexts = upsertContextAtIndex(collectedContexts, normalizedContext, currentContextIndex);
    const updatedTrails = upsertTrailsForContext(collectedTrails, validation.trails, agenda.contextId);

    // If suggestions need user input, keep pendingContext for merge in extract_context
    const hasSuggestions = rolePositionSuggestions.length > 0;

    return {
      phase: PHASE.awaiting_context_confirmation,
      collectedContexts: updatedContexts,
      collectedTrails: updatedTrails,
      normalizations,
      rolePositionSuggestions,
      missingFields: [],
      clarificationRound: 0,
      pendingContext: hasSuggestions ? normalizedContext : null,
      pendingTrails: hasSuggestions ? validation.trails : [],
    };
  },
);

export { extractMissingFields, validateAndCollectMissing };
