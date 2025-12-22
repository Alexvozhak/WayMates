import { adhocContextBase } from "../../../../shared/schemas.js";
import { GRAPH_INTENT } from "../../../services/orchestrator/intent-classifier.js";
import { loadExtractionDicts } from "../../shared/dictionary-hints.js";
import { getModel } from "../../shared-tools/models.js";
import { buildAdhocExtractionPrompt } from "../prompts.js";
import { withLogging } from "../with-logging.js";

import type { AdhocContextBase } from "../../../../shared/schemas.js";
import type { ExtractionDictionaries } from "../../shared/dictionary-hints.js";
import type { SearchStateType } from "../state.js";

const extractor = getModel("extraction").withStructuredOutput(adhocContextBase);

async function extractAdhocContext(message: string, dicts: ExtractionDictionaries): Promise<AdhocContextBase | null> {
  const prompt = buildAdhocExtractionPrompt(dicts);
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
  "load_context",
  async (state, _config, { coreClient, normalizer, cache }) => {
    if (state.intent === GRAPH_INTENT.startAdhoc) {
      const dicts = await loadExtractionDicts(cache);
      const extracted = await extractAdhocContext(state.userResponse, dicts);
      const adhocContext = extracted ? await normalizer.normalizeAdhocContext(extracted, state.userId) : null;

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
