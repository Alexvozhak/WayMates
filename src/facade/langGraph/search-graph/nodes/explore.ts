import { AgentInvariantError } from "../../../errors.js";
import { hasConfigDeps } from "../../shared/types.js";
import { NODE, PHASE } from "../state.js";

import type { SearchStateType } from "../state.js";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";

/**
 * Explore node: searches ALL candidates without goal filter.
 * Used when user has no goal yet or wants to browse all matches.
 */
export async function exploreNode(
  state: SearchStateType,
  config: LangGraphRunnableConfig,
): Promise<Partial<SearchStateType>> {
  const { userId, adhocContext } = state;

  if (!hasConfigDeps(config)) {
    throw new AgentInvariantError(NODE.explore, "Missing coreClient or normalizer");
  }
  const { coreClient } = config.configurable;

  const results = adhocContext
    ? await coreClient.client.search.adhoc.query({
        userId,
        referenceContext: adhocContext,
      })
    : await coreClient.client.search.byUser.query({
        userId,
      });

  return {
    explorationResults: results,
    phase: PHASE.showingExploration,
  };
}
