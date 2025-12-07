import { AgentInvariantError } from "../../../errors.js";
import { hasUserService } from "../../shared/types.js";
import { PHASE } from "../state.js";

import type { ColdStartStateType } from "../state.js";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";

export async function persistNode(
  state: ColdStartStateType,
  config: LangGraphRunnableConfig,
): Promise<Partial<ColdStartStateType>> {
  const { collectedContexts, collectedTrails, queue, userId } = state;

  if (!collectedContexts || collectedContexts.length === 0) {
    throw new AgentInvariantError("persistNode", "collectedContexts must not be empty");
  }

  if (collectedContexts.length !== queue.length) {
    throw new AgentInvariantError("persistNode", "collectedContexts/queue length mismatch");
  }

  if (!hasUserService(config)) {
    throw new AgentInvariantError("persistNode", "Missing coreClient, normalizer or userService");
  }
  const { coreClient, normalizer, userService } = config.configurable;

  const normalizedContexts = await Promise.all(
    collectedContexts.map((ctx) => normalizer.normalizeFullContext(ctx, userId)),
  );

  await coreClient.client.story.upsertStory.mutate({
    userId,
    contexts: normalizedContexts,
    trails: collectedTrails,
  });

  await userService.markColdStartCompleted(userId);

  return { phase: PHASE.saved };
}
