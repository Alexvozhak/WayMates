import { parseDecision } from "../../shared/decision.js";

import type { UpsertContextStateType } from "../state.js";

export const parseDecisionNode = (state: UpsertContextStateType): Promise<Partial<UpsertContextStateType>> =>
  parseDecision(state);
