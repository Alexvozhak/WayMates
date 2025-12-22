import { AgentInvariantError } from "../../../errors.js";
import { PHASE } from "../state.js";
import { withLogging } from "../with-logging.js";

import type { ColdStartStateType } from "../state.js";

export const persistNode = withLogging<ColdStartStateType>(
  "persist",
  async (state, _config, { coreClient, normalizer }) => {
    const { collectedContexts, collectedTrails, queue, userId } = state;

    if (!collectedContexts || collectedContexts.length === 0) {
      throw new AgentInvariantError("persistNode", "collectedContexts must not be empty");
    }

    if (collectedContexts.length !== queue.length) {
      throw new AgentInvariantError("persistNode", "collectedContexts/queue length mismatch");
    }

    const normalizedContexts = await Promise.all(
      collectedContexts.map((ctx) => normalizer.normalizeFullContext(ctx, userId)),
    );

    await coreClient.client.story.upsertStory.mutate({
      userId,
      contexts: normalizedContexts,
      trails: collectedTrails,
    });

    return { phase: PHASE.saved };
  },
);
