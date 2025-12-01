import { InvalidStateError } from "../../mcp-server/tools/errors.js";

import { PHASE } from "./types.js";

import type { ColdStartPhase, ColdStartResponse, ColdStartState } from "./types.js";

type ResponseBuilder<P extends ColdStartPhase> = (state: ColdStartState) => Extract<ColdStartResponse, { phase: P }>;

export const responseBuilders: { [P in ColdStartPhase]: ResponseBuilder<P> } = {
  [PHASE.story_gathering]: () => ({
    phase: PHASE.story_gathering,
    message: "Tell me about your career history.",
  }),

  [PHASE.awaiting_plan_confirmation]: (state) => {
    if (state.queue.length === 0) {
      throw new InvalidStateError(PHASE.awaiting_plan_confirmation, "queue is empty");
    }
    return {
      phase: PHASE.awaiting_plan_confirmation,
      queue: state.queue,
    };
  },

  [PHASE.awaiting_clarification]: (state) => {
    if (state.missingFields.length === 0) {
      throw new InvalidStateError(PHASE.awaiting_clarification, "missingFields is empty");
    }
    return {
      phase: PHASE.awaiting_clarification,
      missingFields: state.missingFields,
    };
  },

  [PHASE.awaiting_context_confirmation]: (state) => {
    const { collectedContexts, collectedTrails, currentEntityContext, queue } = state;

    if (!currentEntityContext) {
      throw new InvalidStateError(PHASE.awaiting_context_confirmation, "currentEntityContext is missing");
    }

    const currentContext = collectedContexts.at(-1);
    if (!currentContext) {
      throw new InvalidStateError(PHASE.awaiting_context_confirmation, "no collected contexts");
    }

    return {
      phase: PHASE.awaiting_context_confirmation,
      entity: currentContext,
      relatedTrails: collectedTrails.filter((t) => t.toContextId === currentContext.contextId),
      progress: { current: currentEntityContext.contextIndex + 1, total: queue.length },
    };
  },

  [PHASE.awaiting_final_confirmation]: (state) => {
    const { collectedContexts, collectedTrails } = state;
    return {
      phase: PHASE.awaiting_final_confirmation,
      preview: { contexts: collectedContexts, trails: collectedTrails },
      summary: { contextsCount: collectedContexts.length, trailsCount: collectedTrails.length },
    };
  },

  [PHASE.saved]: (state) => ({
    phase: PHASE.saved,
    userId: state.userId,
    contexts: state.collectedContexts,
    trails: state.collectedTrails,
  }),

  [PHASE.already_saved]: () => ({
    phase: PHASE.already_saved,
    message: "Cold start already saved.",
  }),

  [PHASE.failed]: () => ({
    phase: PHASE.failed,
    message: "Workflow failed. Please try again.",
  }),
};

export const failedResponse: ColdStartResponse = {
  phase: PHASE.failed,
  message: "Workflow failed. Please try again.",
};
