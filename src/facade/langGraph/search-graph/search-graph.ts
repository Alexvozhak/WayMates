import { Command, END, START, StateGraph } from "@langchain/langgraph";

import { CONTEXT_FIELD_NAMES } from "../../../shared/schemas.js";
import { createInterruptPhaseExtractor } from "../shared/interrupt-utils.js";
import { isGraphState } from "../shared/state-utils.js";

import { applyFiltersNode } from "./nodes/apply-filters.js";
import { askAfterValidateNode } from "./nodes/ask-after-validate.js";
import { cancelNode } from "./nodes/cancel.js";
import { checkGoalNode } from "./nodes/check-goal.js";
import { clarifyGoalNode } from "./nodes/clarify-goal.js";
import { clarifyIntentNode } from "./nodes/clarify-intent.js";
import { deleteGoalNode } from "./nodes/delete-goal.js";
import { exploreNode } from "./nodes/explore.js";
import { extractGoalNode } from "./nodes/extract-goal.js";
import { loadContextNode } from "./nodes/load-context.js";
import { loadExistingGoalNode } from "./nodes/load-existing-goal.js";
import { parseSearchIntentNode } from "./nodes/parse-search-intent.js";
import { searchNode } from "./nodes/search.js";
import { setGoalNode } from "./nodes/set-goal.js";
import { showExplorationNode } from "./nodes/show-exploration.js";
import { showGoalNode } from "./nodes/show-goal.js";
import { showResultsNode } from "./nodes/show-results.js";
import { validateGoalNode } from "./nodes/validate-goal.js";
import { responseBuilders } from "./response-builders.js";
import {
  APPLY_FILTERS_ROUTE_MAP,
  CHECK_GOAL_ROUTE_MAP,
  PARSE_INTENT_ALL_DESTINATIONS,
  routeAfterApplyFilters,
  routeAfterCheckGoal,
  routeAfterParseSearchIntent,
} from "./search-router.js";
import { NODE, PHASE, searchPhaseSchema, searchStateAnnotation } from "./state.js";

import type { SearchStateType } from "./state.js";
import type { SearchGraphResponse } from "./types.js";
import type { UserId } from "../../../shared/schemas.js";
import type { DictionariesCache } from "../../services/dictionaries-cache.js";
import type { UserIntent } from "../../services/orchestrator/intent-classifier.js";
import type { GraphDeps } from "../shared/types.js";

const extractInterruptPhase = createInterruptPhaseExtractor(searchPhaseSchema);

function stateToResponse(state: SearchStateType): SearchGraphResponse {
  const { phase } = state;
  return responseBuilders[phase](state);
}

/* eslint-disable complexity -- UI enrichment with phase-specific filters */
async function enrichResponse(state: SearchStateType, cache: DictionariesCache): Promise<SearchGraphResponse> {
  const baseResponse = stateToResponse(state);

  // showing_goal: add availableFilters (reasons)
  if (baseResponse.phase === "showing_goal" && state.phase === PHASE.showing_goal) {
    const reasons = await cache.getReasons();
    return {
      ...baseResponse,
      availableFilters: {
        reasons: [...reasons.keys()],
      },
    };
  }

  // showing_exploration: add currentFilters + optionally appliedCurrentFilters
  if (baseResponse.phase === "showing_exploration" && state.phase === PHASE.showing_exploration) {
    return {
      ...baseResponse,
      currentFilters: {
        contextFields: CONTEXT_FIELD_NAMES,
      },
      ...(state.appliedFilters && { appliedCurrentFilters: state.appliedFilters }),
    };
  }

  // showing_results: add both availableFilters (reasons) and currentFilters (contextFields)
  if (baseResponse.phase === "showing_results" && state.phase === PHASE.showing_results) {
    const reasons = await cache.getReasons();
    return {
      ...baseResponse,
      availableFilters: {
        reasons: [...reasons.keys()],
      },
      currentFilters: {
        contextFields: CONTEXT_FIELD_NAMES,
      },
      ...(state.appliedFilters && { appliedCurrentFilters: state.appliedFilters }),
    };
  }

  return baseResponse;
}
/* eslint-enable complexity */

/* eslint-disable @typescript-eslint/explicit-function-return-type -- LangGraph complex generics */
export function createGraphBuilder() {
  // prettier-ignore
  return new StateGraph(searchStateAnnotation)
    .addNode(NODE.load_context, loadContextNode)
    .addNode(NODE.check_goal, checkGoalNode)
    .addNode(NODE.explore, exploreNode)
    .addNode(NODE.show_exploration, showExplorationNode)
    .addNode(NODE.parse_search_intent, parseSearchIntentNode)
    .addNode(NODE.clarify_intent, clarifyIntentNode)
    .addNode(NODE.extract_goal, extractGoalNode)
    .addNode(NODE.show_goal, showGoalNode)
    .addNode(NODE.clarify_goal, clarifyGoalNode)
    .addNode(NODE.validate_goal, validateGoalNode)
    .addNode(NODE.ask_after_validate, askAfterValidateNode)
    .addNode(NODE.load_existing_goal, loadExistingGoalNode)
    .addNode(NODE.set_goal, setGoalNode)
    .addNode(NODE.delete_goal, deleteGoalNode)
    .addNode(NODE.search, searchNode)
    .addNode(NODE.show_results, showResultsNode)
    .addNode(NODE.apply_filters, applyFiltersNode)
    .addNode(NODE.cancel, cancelNode)

    .addEdge(START, NODE.load_context)
    .addEdge(NODE.load_context, NODE.check_goal)
    .addConditionalEdges(NODE.check_goal, routeAfterCheckGoal, CHECK_GOAL_ROUTE_MAP)

    // show_* nodes → parse_search_intent
    .addEdge(NODE.explore, NODE.show_exploration)
    .addEdge(NODE.show_exploration, NODE.parse_search_intent)
    .addEdge(NODE.extract_goal, NODE.show_goal)
    .addEdge(NODE.show_goal, NODE.parse_search_intent)
    .addEdge(NODE.validate_goal, NODE.ask_after_validate)
    .addEdge(NODE.ask_after_validate, NODE.parse_search_intent)
    .addEdge(NODE.set_goal, NODE.search)
    .addEdge(NODE.search, NODE.show_results)
    .addEdge(NODE.show_results, NODE.parse_search_intent)

    // parse_search_intent → unified routing (dispatches by phase)
    .addConditionalEdges(NODE.parse_search_intent, routeAfterParseSearchIntent, PARSE_INTENT_ALL_DESTINATIONS)

    // Other edges
    .addEdge(NODE.clarify_intent, NODE.parse_search_intent)
    .addEdge(NODE.clarify_goal, NODE.show_goal)
    .addEdge(NODE.load_existing_goal, NODE.show_goal)
    .addEdge(NODE.delete_goal, NODE.explore)
    .addConditionalEdges(NODE.apply_filters, routeAfterApplyFilters, APPLY_FILTERS_ROUTE_MAP)
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
  ): Promise<SearchGraphResponse> {
    const config = { configurable: { thread_id: threadId, ...this.deps } };

    const currentSnapshot = await this.compiledGraph.getState(config);
    const hasPendingInterrupt = currentSnapshot.tasks.length > 0;

    const result = hasPendingInterrupt
      ? await this.compiledGraph.invoke(new Command({ resume: message }), config)
      : await this.compiledGraph.invoke(
          {
            userId,
            intent,
            userResponse: message,
          },
          config,
        );

    const finalSnapshot = await this.compiledGraph.getState(config);
    const interruptPhase = extractInterruptPhase(finalSnapshot);

    if (interruptPhase && isGraphState<SearchStateType>(finalSnapshot.values)) {
      return enrichResponse({ ...finalSnapshot.values, phase: interruptPhase }, this.deps.cache);
    }

    return enrichResponse(result, this.deps.cache);
  }
}

export { PHASE } from "./state.js";
