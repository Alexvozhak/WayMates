import { InvalidStateError } from "../../errors.js";

import { PHASE } from "./state.js";

import type { UpsertContextPhase, UpsertContextStateType } from "./state.js";
import type { UpsertContextResponse } from "./types.js";

type ResponseBuilder = (state: UpsertContextStateType) => UpsertContextResponse;

export const responseBuilders: Record<UpsertContextPhase, ResponseBuilder> = {
  [PHASE.extracting]: () => ({
    phase: PHASE.extracting,
    message: "Processing your request...",
  }),

  [PHASE.awaitingClarification]: (state) => ({
    phase: PHASE.awaitingClarification,
    message: "Please provide the missing information.",
    missingFields: state.missingFields,
  }),

  [PHASE.awaitingConfirmation]: (state) => {
    if (!state.validatedContext) {
      throw new InvalidStateError(PHASE.awaitingConfirmation, "validatedContext is missing");
    }
    return {
      phase: PHASE.awaitingConfirmation,
      message: "Please confirm the position details.",
      context: state.validatedContext,
    };
  },

  [PHASE.saved]: (state) => {
    if (!state.validatedContext) {
      throw new InvalidStateError(PHASE.saved, "validatedContext is missing");
    }
    return {
      phase: PHASE.saved,
      message: "Position saved successfully.",
      context: state.validatedContext,
    };
  },

  [PHASE.cancelled]: () => ({
    phase: PHASE.cancelled,
    message: "Context creation cancelled by user.",
  }),

  [PHASE.failed]: (state) => ({
    phase: PHASE.failed,
    message: state.validationErrors.join("; ") || "Context creation failed.",
  }),
};
