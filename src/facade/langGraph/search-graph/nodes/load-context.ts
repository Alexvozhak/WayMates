import { adhocContextBase } from "../../../../shared/schemas.js";
import { logger } from "../../../logger.js";
import { GRAPH_INTENT } from "../../../services/orchestrator/intent-classifier.js";
import { getModel } from "../../shared-tools/models.js";
import { buildAdhocExtractionPrompt } from "../prompts.js";
import { NODE, PHASE } from "../state.js";
import { withLogging } from "../with-logging.js";

import type { AdhocContextBase } from "../../../../shared/schemas.js";
import type { SearchStateType } from "../state.js";

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
 * Check if adhoc context has at least one valid field for search.
 * Required: position OR role OR countryCode OR domains(1+) OR skills(1+)
 */
function isAdhocContextValid(ctx: AdhocContextBase | null): boolean {
  if (!ctx) return false;
  return (
    ctx.position !== null ||
    ctx.role !== null ||
    ctx.countryCode !== null ||
    (ctx.domains !== null && ctx.domains.length > 0) ||
    (ctx.skills !== null && ctx.skills.length > 0)
  );
}

export const loadContextNode = withLogging<SearchStateType>(
  NODE.load_context,
  async (state, _config, { coreClient, normalizerService, dictionariesService }) => {
    if (state.orchestratorIntent === GRAPH_INTENT.startAdhoc) {
      const hints = await dictionariesService.buildHints(["role", "position", "domain", "skill", "industry"]);
      const extracted = await extractAdhocContext(state.userResponse, hints);
      logger.info({ extracted, userResponse: state.userResponse }, "adhoc extraction result");
      const adhocContext = extracted ? await normalizerService.normalizeAdhocContext(extracted, state.userId) : null;
      logger.info({ adhocContext, isValid: isAdhocContextValid(adhocContext) }, "adhoc context after normalize");

      // Return phase for routing: ask for context if invalid, confirm if valid
      const phase = isAdhocContextValid(adhocContext) ? PHASE.confirming_adhoc_context : PHASE.asking_adhoc_context;

      return { adhocContext, userResponse: "", phase };
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
