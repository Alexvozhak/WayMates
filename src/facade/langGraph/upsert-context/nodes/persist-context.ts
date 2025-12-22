import { PHASE } from "../state.js";
import { withLogging } from "../with-logging.js";

import type { UpsertContextStateType } from "../state.js";

export const persistContextNode = withLogging<UpsertContextStateType>(
  "persist_context",
  async (state, _config, { coreClient, normalizer }) => {
    const { validatedContext, userId } = state;

    if (!validatedContext) {
      return { phase: PHASE.failed };
    }

    const normalized = await normalizer.normalizeFullContext(validatedContext, userId);

    await coreClient.client.context.upsertContext.mutate({ userId, context: normalized });

    return { phase: PHASE.saved };
  },
);
