import { buildAdhocClarificationPrompt, buildAdhocExtractionPrompt } from "@prompts/search-graph/extraction.js";

import {
  ADHOC_OPTIONAL_FIELDS,
  ADHOC_REQUIRED_FIELDS,
  adhocContextBase,
  adhocContextRequiredSchema,
} from "../../../../shared/schemas.js";
import { logger } from "../../../logger.js";
import { GRAPH_INTENT } from "../../../services/orchestrator/intent-classifier.js";
import { withReasoning } from "../../../utils/llm-schemas.js";
import { hasValue } from "../../shared/state-utils.js";
import { getModel } from "../../shared-tools/models.js";
import { NODE, PHASE } from "../state.js";
import { withLogging } from "../with-logging.js";

import type {
  AdhocContextBase,
  AdhocMissingField,
  AdhocOptionalField,
  AdhocRequiredField,
} from "../../../../shared/schemas.js";
import type { SearchPhase, SearchStateType } from "../state.js";

const extractor = getModel("extraction").withStructuredOutput(
  withReasoning(
    adhocContextBase,
    "For each field: 1) what user said, 2) which KNOWN value matched (or why null). For arrays (domains, skills): list ALL terms user mentioned and explain which were included/excluded and why. Quote KNOWN lists.",
  ),
);

async function extractAdhocContext(message: string, hints: string): Promise<AdhocContextBase | null> {
  const prompt = buildAdhocExtractionPrompt(hints);
  const { reasoning, ...extracted } = await extractor.invoke([
    { role: "system", content: prompt },
    { role: "user", content: message },
  ]);
  logger.info({ reasoning }, "adhoc context extraction reasoning");

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

  const { reasoning, ...updated } = await extractor.invoke([
    { role: "system", content: prompt },
    { role: "user", content: message },
  ]);
  logger.info({ reasoning }, "adhoc context clarification reasoning");

  if (!updated) return existing;
  return adhocContextBase.parse(updated);
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
        { field: "position", message: "Current grade" },
        { field: "role", message: "Current role" },
        { field: "countryCode", message: "Current country of residence" },
        { field: "domains", message: "Work area" },
      ],
      optionalFields,
    };
  }

  const result = adhocContextRequiredSchema.safeParse(ctx);

  if (result.success) {
    return { isValid: true, missingFields: [], optionalFields };
  }

  // Use same human-readable messages as ctx === null case (lines 77-82)
  const fieldMessages: Record<AdhocRequiredField, string> = {
    position: "Current grade",
    role: "Current role",
    countryCode: "Current country of residence",
    domains: "Work area",
  };
  const requiredFieldsSet = new Set<string>(ADHOC_REQUIRED_FIELDS);
  const isRequiredField = (name: string): name is AdhocRequiredField => requiredFieldsSet.has(name);
  const missingFields: AdhocMissingField[] = result.error.errors.map((err) => {
    const fieldName = String(err.path[0] ?? "");
    return { field: err.path.join("."), message: isRequiredField(fieldName) ? fieldMessages[fieldName] : err.message };
  });

  return { isValid: false, missingFields, optionalFields };
}

export const loadContextNode = withLogging<SearchStateType>(
  NODE.load_context,
  async (state, _config, { coreClient, normalizerService, dictionariesService }) => {
    if (state.orchestratorIntent === GRAPH_INTENT.startAdhoc) {
      const hints = await dictionariesService.buildHints([
        "role",
        "position",
        "domain",
        "skill",
        "industry",
        "education_level",
      ]);

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

      return {
        adhocContext,
        missingFields,
        optionalFields,
        userResponse: "",
        phase,
        currentSearchParams: state.currentSearchParams,
        targetSearchParams: state.targetSearchParams,
      };
    }

    const story = await coreClient.client.story.getStory.query({ userId: state.userId });
    const userContext = story.contexts.find((ctx) => ctx.nextContextId === null) ?? null;

    return {
      userContext,
      userTrajectory: story.contexts,
      phase: PHASE.checking_goal,
      currentSearchParams: state.currentSearchParams,
      targetSearchParams: state.targetSearchParams,
    };
  },
);
