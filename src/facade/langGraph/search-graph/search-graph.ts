import { Command, END, START, StateGraph } from "@langchain/langgraph";

import { createInterruptPhaseExtractor } from "../shared/interrupt-utils.js";
import { isGraphState } from "../shared/state-utils.js";

import { applyFiltersNode } from "./nodes/apply-filters.js";
import { askAdhocContextNode } from "./nodes/ask-adhoc-context.js";
import { askAfterValidateNode } from "./nodes/ask-after-validate.js";
import { askSearchModeNode } from "./nodes/ask-search-mode.js";
import { cancelNode } from "./nodes/cancel.js";
import { checkGoalNode } from "./nodes/check-goal.js";
import { clarifyIntentNode } from "./nodes/clarify-intent.js";
import { confirmAdhocContextNode } from "./nodes/confirm-adhoc-context.js";
import { deleteGoalNode } from "./nodes/delete-goal.js";
import { exploreNode } from "./nodes/explore.js";
import { extractGoalNode } from "./nodes/extract-goal.js";
import { generateAnswerNode } from "./nodes/generate-answer.js";
import { loadContextNode } from "./nodes/load-context.js";
import { loadExistingGoalNode } from "./nodes/load-existing-goal.js";
import { parseSearchIntentNode } from "./nodes/parse-search-intent.js";
import { searchPathfindersNode } from "./nodes/search-pathfinders.js";
import { searchWaymatesNode } from "./nodes/search-waymates.js";
import { setGoalNode } from "./nodes/set-goal.js";
import { showAnswerNode } from "./nodes/show-answer.js";
import { showExplorationNode } from "./nodes/show-exploration.js";
import { showGoalNode } from "./nodes/show-goal.js";
import { showResultsNode } from "./nodes/show-results.js";
import { validateGoalNode } from "./nodes/validate-goal.js";
import { responseBuilders } from "./response-builders.js";
import {
  APPLY_FILTERS_ROUTE_MAP,
  CHECK_GOAL_ROUTE_MAP,
  LOAD_CONTEXT_ROUTE_MAP,
  PARSE_INTENT_ALL_DESTINATIONS,
  routeAfterApplyFilters,
  routeAfterCheckGoal,
  routeAfterLoadContext,
  routeAfterParseSearchIntent,
} from "./search-router.js";
import { NODE, searchPhaseSchema, searchStateAnnotation } from "./state.js";

import type { SearchStateType } from "./state.js";
import type { SearchGraphResponse } from "./types.js";
import type { Locale, UserId } from "../../../shared/schemas.js";
import type { UserIntent } from "../../services/orchestrator/intent-classifier.js";
import type { GraphDeps } from "../shared/types.js";

const extractInterruptPhase = createInterruptPhaseExtractor(searchPhaseSchema);

function stateToResponse(state: SearchStateType): SearchGraphResponse {
  const { phase } = state;
  return responseBuilders[phase](state);
}

/* eslint-disable @typescript-eslint/explicit-function-return-type -- LangGraph complex generics */
export function createGraphBuilder() {
  // prettier-ignore
  return new StateGraph(searchStateAnnotation)
    .addNode(NODE.load_context, loadContextNode)
    .addNode(NODE.ask_adhoc_context, askAdhocContextNode)
    .addNode(NODE.confirm_adhoc_context, confirmAdhocContextNode)
    .addNode(NODE.check_goal, checkGoalNode)
    .addNode(NODE.explore, exploreNode)
    .addNode(NODE.show_exploration, showExplorationNode)
    .addNode(NODE.parse_search_intent, parseSearchIntentNode)
    .addNode(NODE.clarify_intent, clarifyIntentNode)
    .addNode(NODE.extract_goal, extractGoalNode)
    .addNode(NODE.show_goal, showGoalNode)
    .addNode(NODE.validate_goal, validateGoalNode)
    .addNode(NODE.ask_after_validate, askAfterValidateNode)
    .addNode(NODE.load_existing_goal, loadExistingGoalNode)
    .addNode(NODE.set_goal, setGoalNode)
    .addNode(NODE.ask_search_mode, askSearchModeNode)
    .addNode(NODE.delete_goal, deleteGoalNode)
    .addNode(NODE.search_waymates, searchWaymatesNode)
    .addNode(NODE.search_pathfinders, searchPathfindersNode)
    .addNode(NODE.show_results, showResultsNode)
    .addNode(NODE.apply_filters, applyFiltersNode)
    .addNode(NODE.generate_answer, generateAnswerNode)
    .addNode(NODE.show_answer, showAnswerNode)
    .addNode(NODE.cancel, cancelNode)

    .addEdge(START, NODE.load_context)
    .addConditionalEdges(NODE.load_context, routeAfterLoadContext, LOAD_CONTEXT_ROUTE_MAP)
    .addEdge(NODE.ask_adhoc_context, NODE.load_context)
    .addEdge(NODE.confirm_adhoc_context, NODE.parse_search_intent)
    .addConditionalEdges(NODE.check_goal, routeAfterCheckGoal, CHECK_GOAL_ROUTE_MAP)

    // show_* nodes → parse_search_intent
    .addEdge(NODE.explore, NODE.show_exploration)
    .addEdge(NODE.show_exploration, NODE.parse_search_intent)
    .addEdge(NODE.extract_goal, NODE.show_goal)
    .addEdge(NODE.show_goal, NODE.parse_search_intent)
    .addEdge(NODE.validate_goal, NODE.ask_after_validate)
    .addEdge(NODE.ask_after_validate, NODE.parse_search_intent)
    .addEdge(NODE.set_goal, NODE.ask_search_mode)
    .addEdge(NODE.ask_search_mode, NODE.parse_search_intent)
    .addEdge(NODE.search_waymates, NODE.show_results)
    .addEdge(NODE.search_pathfinders, NODE.show_results)
    .addEdge(NODE.show_results, NODE.parse_search_intent)

    // parse_search_intent → unified routing (dispatches by phase)
    .addConditionalEdges(NODE.parse_search_intent, routeAfterParseSearchIntent, PARSE_INTENT_ALL_DESTINATIONS)

    // Other edges
    .addEdge(NODE.clarify_intent, NODE.parse_search_intent)
    .addEdge(NODE.load_existing_goal, NODE.show_goal)
    .addEdge(NODE.delete_goal, NODE.explore)
    .addConditionalEdges(NODE.apply_filters, routeAfterApplyFilters, APPLY_FILTERS_ROUTE_MAP)

    // Advisor flow: generate_answer → show_answer → parse_search_intent (unified routing)
    .addEdge(NODE.generate_answer, NODE.show_answer)
    .addEdge(NODE.show_answer, NODE.parse_search_intent)

    .addEdge(NODE.cancel, END);
}
/* eslint-enable @typescript-eslint/explicit-function-return-type */

type CompiledGraph = ReturnType<ReturnType<typeof createGraphBuilder>["compile"]>;

export class SearchGraph {
  private readonly compiledGraph: CompiledGraph;

  constructor(private readonly deps: GraphDeps) {
    this.compiledGraph = createGraphBuilder().compile({ checkpointer: deps.checkpointService.getCheckpointer() });
  }

  async run(
    message: string,
    threadId: string,
    userId: UserId,
    intent: UserIntent | null,
    locale: Locale,
  ): Promise<SearchGraphResponse> {
    const config = { configurable: { thread_id: threadId, ...this.deps } };

    const currentSnapshot = await this.compiledGraph.getState(config);
    const hasPendingInterrupt = currentSnapshot.tasks.length > 0;

    const result = hasPendingInterrupt
      ? await this.compiledGraph.invoke(new Command({ resume: message }), config)
      : await this.compiledGraph.invoke(
          {
            userId,
            locale,
            orchestratorIntent: intent,
            userResponse: message,
          },
          config,
        );

    const finalSnapshot = await this.compiledGraph.getState(config);
    const interruptPhase = extractInterruptPhase(finalSnapshot);

    if (interruptPhase && isGraphState<SearchStateType>(finalSnapshot.values)) {
      return stateToResponse({ ...finalSnapshot.values, phase: interruptPhase });
    }

    return stateToResponse(result);
  }
}

export { PHASE } from "./state.js";
