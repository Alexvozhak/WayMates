import {
  CONTEXT_OPTIONAL_FIELDS,
  missingFieldSchema,
  trailSchema,
  userContextSchema,
} from "../../../../shared/schemas.js";
import { config } from "../../../env.js";
import { AgentInvariantError } from "../../../errors.js";
import { NODE, PHASE } from "../types.js";
import { withLogging } from "../with-logging.js";

import type { ContextOptionalField, UserId } from "../../../../shared/schemas.js";
import type { Normalizer } from "../../../services/normalizer.js";
import type { ExtractableContext, ExtractableTrail } from "../../shared-tools/extraction-models.js";
import type { ColdStartStateType, ContextAgenda, MissingField, Trail, UserContext } from "../state.js";
import type { NormalizationEntry } from "../types.js";
import type { z } from "zod";

const MAX_QUESTIONS_PER_BATCH = config.LANGCHAIN_MAX_QUESTIONS_PER_BATCH;
const MAX_CLARIFICATION_ROUNDS = config.LANGCHAIN_MAX_CLARIFICATION_ROUNDS;

function hasValue(value: unknown): boolean {
  if (value == null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.length > 0;
  return true;
}

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

function validateTrails(
  trailsData: ExtractableTrail[],
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
  contextData: ExtractableContext,
  trailsData: ExtractableTrail[],
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

type NormalizationResult = {
  normalizedContext: UserContext;
  normalizations: NormalizationEntry[];
};

function collectFieldDiff(
  field: "position" | "role" | "industry",
  original: string,
  normalized: string,
): NormalizationEntry | null {
  return original === normalized ? null : { field, original, normalized };
}

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
  const normalizedContext = await normalizer.normalizeFullContext(context, userId);

  const normalizations: NormalizationEntry[] = [];

  const positionDiff = collectFieldDiff("position", context.position, normalizedContext.position);
  if (positionDiff) normalizations.push(positionDiff);

  const roleDiff = collectFieldDiff("role", context.role, normalizedContext.role);
  if (roleDiff) normalizations.push(roleDiff);

  const industryDiff = collectFieldDiff("industry", context.industry, normalizedContext.industry);
  if (industryDiff) normalizations.push(industryDiff);

  normalizations.push(...collectDomainsDiff(context.domains, normalizedContext.domains));

  return { normalizedContext, normalizations };
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

    const { normalizedContext, normalizations } = await normalizeAndCollectDiff(
      validation.context,
      userId,
      normalizerService,
    );

    const updatedContexts = upsertContextAtIndex(collectedContexts, normalizedContext, currentContextIndex);
    const updatedTrails = upsertTrailsForContext(collectedTrails, validation.trails, agenda.contextId);

    return {
      phase: PHASE.awaiting_context_confirmation,
      collectedContexts: updatedContexts,
      collectedTrails: updatedTrails,
      normalizations,
      missingFields: [],
      clarificationRound: 0,
      pendingContext: null,
      pendingTrails: [],
    };
  },
);

export { extractMissingFields, validateAndCollectMissing };
