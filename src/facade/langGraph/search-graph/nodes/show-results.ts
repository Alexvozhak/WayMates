import { interrupt } from "@langchain/langgraph";

import { generateTrajectoryChart, isChartServiceEnabled } from "../../../../chart/index.js";
import { OPTIONS, PHASE } from "../state.js";

import { parseUserIntent } from "./parse-intent.js";

import type { SearchStateType } from "../state.js";

/**
 * Show results node: displays search results with current goal and waits for user decision.
 * User can change goal, delete goal (return to explore), or finish.
 */
export async function showResultsNode(state: SearchStateType): Promise<Partial<SearchStateType>> {
  let chartUrl: string | undefined;

  if (isChartServiceEnabled() && state.searchResults.length > 0 && state.userTrajectory.length > 0) {
    try {
      const result = await generateTrajectoryChart({
        userTrajectory: state.userTrajectory,
        candidates: state.searchResults.slice(0, 5),
        locale: "ru",
        existingGoal: Boolean(state.existingGoal),
      });
      chartUrl = result.chartUrl;
    } catch (error) {
      console.error("Chart generation failed:", error);
    }
  }

  const userResponse = interrupt({
    type: "show_results",
    results: state.searchResults,
    goal: state.existingGoal,
    chartUrl,
    options: OPTIONS.showResults,
    phase: PHASE.showingResults,
  });

  const response = String(userResponse);
  const parsed = await parseUserIntent(response);

  const clarificationText = parsed.intent === "clarify" ? parsed.clarificationText : null;

  return {
    userResponse: response,
    searchUserIntent: parsed.intent,
    clarificationText,
    chartUrl: chartUrl ?? null,
  };
}
