import { InvalidStateError } from "../../errors.js";

import { PHASE } from "./state.js";

import type { UpdateContextPhase, UpdateContextStateType } from "./state.js";
import type { UpdateContextResponse } from "../../../shared/schemas.js";

type ResponseBuilder = (state: UpdateContextStateType) => UpdateContextResponse;

export const responseBuilders: Record<UpdateContextPhase, ResponseBuilder> = {
  [PHASE.extracting]: () => ({
    phase: PHASE.extracting,
    message: "Processing your request...",
  }),

  [PHASE.awaitingClarification]: (state) => ({
    phase: PHASE.awaitingClarification,
    missingFields: state.missingFields,
  }),

  [PHASE.awaitingConfirmation]: (state) => {
    if (!state.currentContext) {
      throw new InvalidStateError(PHASE.awaitingConfirmation, "currentContext is missing");
    }
    if (!state.mergedContext) {
      throw new InvalidStateError(PHASE.awaitingConfirmation, "mergedContext is missing");
    }
    return {
      phase: PHASE.awaitingConfirmation,
      before: state.currentContext,
      after: state.mergedContext,
    };
  },

  [PHASE.saved]: (state) => {
    if (!state.mergedContext) {
      throw new InvalidStateError(PHASE.saved, "mergedContext is missing");
    }
    return {
      phase: PHASE.saved,
      updatedContext: state.mergedContext,
    };
  },

  [PHASE.cancelled]: () => ({
    phase: PHASE.cancelled,
    message: "Context update cancelled by user.",
  }),

  [PHASE.failed]: (state) => ({
    phase: PHASE.failed,
    message: state.validationErrors.join("; ") || "Update failed.",
  }),
};
