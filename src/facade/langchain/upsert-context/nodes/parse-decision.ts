import { parseDecision } from "../../shared/index.js";

import type { UpsertContextStateType } from "../state.js";

export const parseDecisionNode = (state: UpsertContextStateType): Promise<Partial<UpsertContextStateType>> =>
  parseDecision(state);
