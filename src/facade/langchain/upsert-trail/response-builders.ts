import { InvalidStateError } from "../../errors.js";

import { PHASE } from "./state.js";

import type { UpsertTrailPhase, UpsertTrailStateType } from "./state.js";
import type { UpsertTrailResponse } from "./types.js";

type ResponseBuilder = (state: UpsertTrailStateType) => UpsertTrailResponse;

export const responseBuilders: Record<UpsertTrailPhase, ResponseBuilder> = {
  [PHASE.extracting]: () => ({
    phase: PHASE.extracting,
    message: "Extracting trail information...",
  }),

  [PHASE.awaitingConfirmation]: (state) => {
    if (!state.validatedTrail) {
      throw new InvalidStateError(PHASE.awaitingConfirmation, "validatedTrail is missing");
    }
    return {
      phase: PHASE.awaitingConfirmation,
      trail: state.validatedTrail,
    };
  },

  [PHASE.approved]: (state) => {
    if (!state.validatedTrail) {
      throw new InvalidStateError(PHASE.approved, "validatedTrail is missing");
    }
    return {
      phase: PHASE.approved,
      trail: state.validatedTrail,
    };
  },

  [PHASE.cancelled]: () => ({
    phase: PHASE.cancelled,
    message: "Trail creation cancelled by user.",
  }),

  [PHASE.failed]: (state) => ({
    phase: PHASE.failed,
    message: state.validationErrors.join("; ") || "Failed to create trail.",
  }),
};
