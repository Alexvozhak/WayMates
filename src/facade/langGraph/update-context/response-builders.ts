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

  [PHASE.awaiting_clarification]: (state) => ({
    phase: PHASE.awaiting_clarification,
    message: "Please provide the missing information.",
    missingFields: state.missingFields,
  }),

  [PHASE.awaiting_confirmation]: (state) => {
    if (!state.currentContext) {
      throw new InvalidStateError(PHASE.awaiting_confirmation, "currentContext is missing");
    }
    if (!state.mergedContext) {
      throw new InvalidStateError(PHASE.awaiting_confirmation, "mergedContext is missing");
    }
    return {
      phase: PHASE.awaiting_confirmation,
      message: "Please confirm the changes.",
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
      message: "Position updated successfully.",
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
