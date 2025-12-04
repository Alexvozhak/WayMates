import { parseDecision } from "../../shared/index.js";

import type { UpsertTrailStateType } from "../state.js";

export const parseDecisionNode = (state: UpsertTrailStateType): Promise<Partial<UpsertTrailStateType>> =>
  parseDecision(state);
