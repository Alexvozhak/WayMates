import { PHASE } from "./types.js";

import type { UpdateContextPhase, UpdateContextResponse, UpdateContextState } from "./types.js";

type ResponseBuilder<P extends UpdateContextPhase> = (
  state: UpdateContextState,
) => Extract<UpdateContextResponse, { phase: P }>;

export const responseBuilders: { [P in UpdateContextPhase]: ResponseBuilder<P> } = {
  [PHASE.collecting]: () => ({
    phase: PHASE.collecting,
    message: "Processing your request...",
  }),

  [PHASE.awaiting_clarification]: () => ({
    phase: PHASE.awaiting_clarification,
    message: "Need more information",
    missingFields: [],
  }),

  [PHASE.awaiting_confirmation]: (state) => ({
    phase: PHASE.awaiting_confirmation,
    before: state.currentContext!,
    after: state.updatedContext!,
    diff: {},
  }),

  [PHASE.saved]: (state) => ({
    phase: PHASE.saved,
    updatedContext: state.updatedContext!,
  }),

  [PHASE.failed]: () => ({
    phase: PHASE.failed,
    message: "Update failed",
  }),
};

export const failedResponse: UpdateContextResponse = {
  phase: PHASE.failed,
  message: "Workflow failed",
};
