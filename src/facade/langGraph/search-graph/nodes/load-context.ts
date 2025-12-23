import { adhocContextBase } from "../../../../shared/schemas.js";
import { GRAPH_INTENT } from "../../../services/orchestrator/intent-classifier.js";
import { getModel } from "../../shared-tools/models.js";
import { buildAdhocExtractionPrompt } from "../prompts.js";
import { NODE } from "../state.js";
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

  const hasAnyField = Object.values(extracted).some((v) => v != null);
  if (!hasAnyField) return null;

  return adhocContextBase.parse(extracted);
}

export const loadContextNode = withLogging<SearchStateType>(
  NODE.load_context,
  async (state, _config, { coreClient, normalizerService, dictionariesService }) => {
    if (state.intent === GRAPH_INTENT.startAdhoc) {
      const hints = await dictionariesService.buildHints(["role", "position", "domain", "skill", "industry"]);
      const extracted = await extractAdhocContext(state.userResponse, hints);
      const adhocContext = extracted ? await normalizerService.normalizeAdhocContext(extracted, state.userId) : null;

      return { adhocContext, userResponse: "" };
    }

    const story = await coreClient.client.story.getStory.query({ userId: state.userId });
    const userContext = story.contexts.find((ctx) => ctx.nextContextId === null) ?? null;

    return {
      userContext,
      userTrajectory: story.contexts,
    };
  },
);
