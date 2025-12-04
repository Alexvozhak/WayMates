import { parseDecision } from "../../shared/index.js";

import type { UpdateContextStateType } from "../state.js";

export const parseDecisionNode = (state: UpdateContextStateType): Promise<Partial<UpdateContextStateType>> =>
  parseDecision(state);
