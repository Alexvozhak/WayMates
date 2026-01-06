import { InvalidStateError } from "../../errors.js";

import { PHASE } from "./types.js";

import type { ColdStartPhase, ColdStartState } from "./types.js";
import type { ColdStartResponse } from "../../../shared/schemas.js";

/** After this many failed clarification attempts, suggest cancel to user */
const SUGGEST_CANCEL_AFTER_ROUNDS = 2;

type ResponseBuilder<P extends ColdStartPhase> = (state: ColdStartState) => Extract<ColdStartResponse, { phase: P }>;

export const responseBuilders: { [P in ColdStartPhase]: ResponseBuilder<P> } = {
  [PHASE.story_gathering]: (state) => ({
    phase: PHASE.story_gathering,
    messages: state.messages.map((m) => ({
      role: m.type,
      content: String(m.content),
    })),
  }),

  [PHASE.awaiting_plan_confirmation]: (state) => {
    if (state.queue.length === 0) {
      throw new InvalidStateError(PHASE.awaiting_plan_confirmation, "queue is empty");
    }
    return {
      phase: PHASE.awaiting_plan_confirmation,
      message: "Please confirm the career plan.",
      queue: state.queue,
    };
  },

  [PHASE.awaiting_clarification]: (state) => {
    const hasMissingFields = state.missingFields.length > 0;
    const hasSuggestions = state.rolePositionSuggestions.length > 0;

    if (!hasMissingFields && !hasSuggestions) {
      throw new InvalidStateError(PHASE.awaiting_clarification, "missingFields and rolePositionSuggestions are empty");
    }

    const currentAgenda = state.queue[state.currentContextIndex];
    if (!currentAgenda) {
      throw new InvalidStateError(PHASE.awaiting_clarification, "no agenda at currentContextIndex");
    }

    return {
      phase: PHASE.awaiting_clarification,
      message: "Please provide the missing information.",
      entityPreview: currentAgenda.preview,
      progress: { current: state.currentContextIndex + 1, total: state.queue.length },
      pendingContext: state.pendingContext ?? {},
      missingFields: state.missingFields,
      optionalFields: state.optionalFields,
      suggestCancel: state.clarificationRound >= SUGGEST_CANCEL_AFTER_ROUNDS,
      rolePositionSuggestions: hasSuggestions ? state.rolePositionSuggestions : undefined,
    };
  },

  [PHASE.awaiting_context_confirmation]: (state) => {
    const { collectedContexts, collectedTrails, currentEntityContext, queue, normalizations } = state;

    if (!currentEntityContext) {
      throw new InvalidStateError(PHASE.awaiting_context_confirmation, "currentEntityContext is missing");
    }

    const currentContext = collectedContexts[currentEntityContext.contextIndex];
    if (!currentContext) {
      throw new InvalidStateError(
        PHASE.awaiting_context_confirmation,
        "no collected context at currentEntityContext.contextIndex",
      );
    }

    return {
      phase: PHASE.awaiting_context_confirmation,
      message: "Please confirm this position.",
      entity: currentContext,
      relatedTrails: collectedTrails.filter((t) => t.toContextId === currentContext.contextId),
      progress: { current: currentEntityContext.contextIndex + 1, total: queue.length },
      normalizations,
    };
  },

  [PHASE.awaiting_final_confirmation]: (state) => {
    const { collectedContexts, collectedTrails } = state;
    return {
      phase: PHASE.awaiting_final_confirmation,
      message: "Please confirm your complete career story.",
      preview: { contexts: collectedContexts, trails: collectedTrails },
      summary: { contextsCount: collectedContexts.length, trailsCount: collectedTrails.length },
    };
  },

  [PHASE.saved]: (state) => ({
    phase: PHASE.saved,
    message: "Your career story has been saved.",
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
