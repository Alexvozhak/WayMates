import { PHASE } from "../state.js";
import { withLogging } from "../with-logging.js";

import type { UpdateContextStateType } from "../state.js";

export const persistUpdateNode = withLogging<UpdateContextStateType>(
  "persist_update",
  async (state, _config, { coreClient, normalizer }) => {
    const { mergedContext, userId } = state;

    if (!mergedContext) {
      return { phase: PHASE.failed };
    }

    const normalized = await normalizer.normalizeFullContext(mergedContext, userId);

    await coreClient.client.context.update.mutate({ userId, updates: normalized });

    return { phase: PHASE.saved };
  },
);
