import { AgentInvariantError } from "../../../errors.js";
import { NODE, PHASE } from "../types.js";
import { withLogging } from "../with-logging.js";

import type { ColdStartStateType } from "../state.js";

export const persistNode = withLogging<ColdStartStateType>(NODE.persist, async (state, _config, { coreClient }) => {
  const { collectedContexts, collectedTrails, queue, userId } = state;

  if (!collectedContexts || collectedContexts.length === 0) {
    throw new AgentInvariantError("persistNode", "collectedContexts must not be empty");
  }

  if (collectedContexts.length !== queue.length) {
    throw new AgentInvariantError("persistNode", "collectedContexts/queue length mismatch");
  }

  await coreClient.client.story.upsertStory.mutate({
    userId,
    contexts: collectedContexts,
    trails: collectedTrails,
  });

  return { phase: PHASE.saved };
});
