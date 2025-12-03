import { AgentInvariantError } from "../../../errors.js";
import { PHASE } from "../state.js";

import type { ColdStartStateType } from "../state.js";

export function persistNode(state: ColdStartStateType): Partial<ColdStartStateType> {
  const { collectedContexts, queue } = state;

  if (!collectedContexts || collectedContexts.length === 0) {
    throw new AgentInvariantError("persistNode", "collectedContexts must not be empty at persist phase", {
      collectedContextsLength: collectedContexts?.length ?? 0,
    });
  }

  if (collectedContexts.length !== queue.length) {
    throw new AgentInvariantError("persistNode", "collectedContexts/queue length mismatch", {
      collectedContextsLength: collectedContexts.length,
      queueLength: queue.length,
    });
  }

  return {
    phase: PHASE.saved,
  };
}
