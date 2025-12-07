import { parseDecision } from "../../shared/decision.js";

import type { UpsertTrailStateType } from "../state.js";

export const parseDecisionNode = (state: UpsertTrailStateType): Promise<Partial<UpsertTrailStateType>> =>
  parseDecision(state);
