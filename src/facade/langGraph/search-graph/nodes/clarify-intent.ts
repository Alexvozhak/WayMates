import { interrupt } from "@langchain/langgraph";

import { AgentInvariantError } from "../../../errors.js";
import { NODE, OPTIONS, PHASE } from "../state.js";

import type { SearchPhase, SearchStateType } from "../state.js";

const PHASE_OPTIONS = new Map<SearchPhase, string[]>([
  [PHASE.showing_exploration, OPTIONS.showExploration],
  [PHASE.showing_goal, OPTIONS.showGoal],
  [PHASE.asking_after_validate, OPTIONS.askAfterValidate],
  [PHASE.showing_results, OPTIONS.showResults],
]);

export function clarifyIntentNode(state: SearchStateType): Partial<SearchStateType> {
  const { phase } = state;

  const options = PHASE_OPTIONS.get(phase);
  if (!options) {
    throw new AgentInvariantError(NODE.clarify_intent, `No options for phase: ${phase}`);
  }

  const userResponse = interrupt({
    type: "clarify_intent",
    message: "I didn't understand your response. Please choose an action:",
    options,
    phase,
  });

  return { userResponse: String(userResponse) };
}
