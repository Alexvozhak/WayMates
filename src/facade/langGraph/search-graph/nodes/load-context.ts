import { ADHOC_OPTIONAL_FIELDS, adhocContextBase, adhocContextRequiredSchema } from "../../../../shared/schemas.js";
import { logger } from "../../../logger.js";
import { GRAPH_INTENT } from "../../../services/orchestrator/intent-classifier.js";
import { getModel } from "../../shared-tools/models.js";
import { buildAdhocClarificationPrompt, buildAdhocExtractionPrompt } from "../prompts/extraction.js";
import { NODE, PHASE } from "../state.js";
import { withLogging } from "../with-logging.js";

import type { AdhocContextBase, AdhocMissingField, AdhocOptionalField } from "../../../../shared/schemas.js";
import type { SearchPhase, SearchStateType } from "../state.js";

const extractor = getModel("extraction").withStructuredOutput(adhocContextBase);

async function extractAdhocContext(message: string, hints: string): Promise<AdhocContextBase | null> {
  const prompt = buildAdhocExtractionPrompt(hints);
  const extracted = await extractor.invoke([
    { role: "system", content: prompt },
    { role: "user", content: message },
  ]);

  if (!extracted) return null;

  // LLM returns "" instead of null with structured output — filter them out
  const hasAnyField = Object.values(extracted).some(
    (v) => v != null && v !== "" && !(Array.isArray(v) && v.length === 0),
  );
  if (!hasAnyField) return null;

  return adhocContextBase.parse(extracted);
}

/**
 * Update existing adhoc context with new user input.
 * LLM merges existing + new, keeping fields user didn't mention.
 */
async function clarifyAdhocContext(
  existing: AdhocContextBase,
  message: string,
  hints: string,
): Promise<AdhocContextBase | null> {
  const prompt = buildAdhocClarificationPrompt(hints, JSON.stringify(existing), message);

  const updated = await extractor.invoke([
    { role: "system", content: prompt },
    { role: "user", content: message },
  ]);

  if (!updated) return existing;
  return adhocContextBase.parse(updated);
}

/**
 * Check if optional field has a value.
 */
function hasValue(value: unknown): boolean {
  if (value == null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.length > 0;
  return true;
}

/**
 * Validate adhoc context using Zod safeParse.
 * Returns missing required fields and unfilled optional fields.
 */
function validateAdhocContext(ctx: AdhocContextBase | null): {
  isValid: boolean;
  missingFields: AdhocMissingField[];
  optionalFields: AdhocOptionalField[];
} {
  // Unfilled optional fields
  const optionalFields = ADHOC_OPTIONAL_FIELDS.filter((f) => !ctx || !hasValue(ctx[f]));

  if (!ctx) {
    return {
      isValid: false,
      missingFields: [
        { field: "position", message: "Level (junior/middle/senior)" },
        { field: "role", message: "Specialty (backend/frontend/etc)" },
        { field: "countryCode", message: "Work location country" },
        { field: "domains", message: "Work area (at least 1)" },
      ],
      optionalFields,
    };
  }

  const result = adhocContextRequiredSchema.safeParse(ctx);

  if (result.success) {
    return { isValid: true, missingFields: [], optionalFields };
  }

  const missingFields: AdhocMissingField[] = result.error.errors.map((err) => ({
    field: err.path.join("."),
    message: err.message,
  }));

  return { isValid: false, missingFields, optionalFields };
}

export const loadContextNode = withLogging<SearchStateType>(
  NODE.load_context,
  async (state, _config, { coreClient, normalizerService, dictionariesService }) => {
    if (state.orchestratorIntent === GRAPH_INTENT.startAdhoc) {
      const hints = await dictionariesService.buildHints(["role", "position", "domain", "skill", "industry"]);

      // If we have existing context, clarify (merge). Otherwise, extract from scratch.
      const existing = state.adhocContext;
      const extracted = existing
        ? await clarifyAdhocContext(existing, state.userResponse, hints)
        : await extractAdhocContext(state.userResponse, hints);

      logger.info({ extracted, userResponse: state.userResponse, hasExisting: !!existing }, "adhoc extraction result");

      const adhocContext = extracted ? await normalizerService.normalizeAdhocContext(extracted, state.userId) : null;
      const { isValid, missingFields, optionalFields } = validateAdhocContext(adhocContext);
      logger.info({ adhocContext, isValid, missingFields, optionalFields }, "adhoc context after normalize");

      // Skip confirmation if came from exploration (already saw results)
      const cameFromExploration =
        state.phase === PHASE.showing_exploration_candidates || state.phase === PHASE.showing_exploration_facets;

      let phase: SearchPhase;
      if (!isValid) {
        phase = PHASE.asking_adhoc_context;
      } else if (cameFromExploration) {
        phase = PHASE.exploring;
      } else {
        phase = PHASE.confirming_adhoc_context;
      }

      return { adhocContext, missingFields, optionalFields, userResponse: "", phase };
    }

    const story = await coreClient.client.story.getStory.query({ userId: state.userId });
    const userContext = story.contexts.find((ctx) => ctx.nextContextId === null) ?? null;

    return {
      userContext,
      userTrajectory: story.contexts,
      phase: PHASE.checking_goal,
    };
  },
);
