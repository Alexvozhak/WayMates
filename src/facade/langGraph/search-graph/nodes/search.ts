import { hasConfigDeps } from "../../shared/types.js";
import { PHASE } from "../state.js";

import type { SearchStateType } from "../state.js";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";

export async function searchNode(
  state: SearchStateType,
  config: LangGraphRunnableConfig,
): Promise<Partial<SearchStateType>> {
  const { userId, adhocContext } = state;

  if (!hasConfigDeps(config)) {
    return { phase: PHASE.failed };
  }
  const { coreClient } = config.configurable;

  // Adhoc mode: use temporary context instead of user's saved context
  const results = adhocContext
    ? await coreClient.client.search.adhoc.query({
        userId,
        referenceContext: adhocContext,
      })
    : await coreClient.client.search.byUser.query({
        userId,
      });

  return {
    searchResults: results,
    phase: PHASE.showingResults,
  };
}
