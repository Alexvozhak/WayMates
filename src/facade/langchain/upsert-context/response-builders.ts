import { PHASE } from "./types.js";

import type { UpsertContextPhase, UpsertContextResponse, UpsertContextState } from "./types.js";

type ResponseBuilder<P extends UpsertContextPhase> = (
  state: UpsertContextState,
) => Extract<UpsertContextResponse, { phase: P }>;

export const responseBuilders: { [P in UpsertContextPhase]: ResponseBuilder<P> } = {
  [PHASE.extracting]: () => ({
    phase: PHASE.extracting,
    message: "Processing your request...",
  }),

  [PHASE.awaiting_confirmation]: (state) => {
    if (!state.validatedContext) {
      throw new Error("validatedContext required for awaiting_confirmation");
    }
    return {
      phase: PHASE.awaiting_confirmation,
      context: state.validatedContext,
    };
  },

  [PHASE.saved]: (state) => {
    if (!state.validatedContext) {
      throw new Error("validatedContext required for saved");
    }
    return {
      phase: PHASE.saved,
      context: state.validatedContext,
    };
  },

  [PHASE.failed]: () => ({
    phase: PHASE.failed,
    message: "Context creation failed",
  }),
};

export const failedResponse: UpsertContextResponse = {
  phase: PHASE.failed,
  message: "Workflow failed",
};
