import { Command, END, START, StateGraph } from "@langchain/langgraph";
import { z } from "zod";

import { AgentInvariantError } from "../../errors.js";

import { askAfterValidateNode } from "./nodes/ask-after-validate.js";
import { cancelNode } from "./nodes/cancel.js";
import { checkGoalNode } from "./nodes/check-goal.js";
import { clarifyGoalNode } from "./nodes/clarify-goal.js";
import { deleteGoalNode } from "./nodes/delete-goal.js";
import { exploreNode } from "./nodes/explore.js";
import { extractGoalNode } from "./nodes/extract-goal.js";
import { loadContextNode } from "./nodes/load-context.js";
import { loadExistingGoalNode } from "./nodes/load-existing-goal.js";
import { searchNode } from "./nodes/search.js";
import { setGoalNode } from "./nodes/set-goal.js";
import { showExplorationNode } from "./nodes/show-exploration.js";
import { showGoalNode } from "./nodes/show-goal.js";
import { showResultsNode } from "./nodes/show-results.js";
import { validateGoalNode } from "./nodes/validate-goal.js";
import { responseBuilders } from "./response-builders.js";
import {
  buildRouteMap,
  routeAfterAskAfterValidate,
  routeAfterCheckGoal,
  routeAfterShowExploration,
  routeAfterShowGoal,
  routeAfterShowResults,
} from "./search-router.js";
import { NODE, searchStateAnnotation } from "./state.js";

import type { SearchPhase, SearchStateType } from "./state.js";
import type { SearchGraphResponse } from "./types.js";
import type { UserId } from "../../../shared/schemas.js";
import type { UserIntent } from "../../services/orchestrator/intent-classifier.js";
import type { GraphDeps } from "../shared/types.js";
import type { StateSnapshot } from "@langchain/langgraph";

const interruptValueSchema = z.object({
  phase: z.string().optional(),
});

function stateToResponse(state: SearchStateType): SearchGraphResponse {
  const { phase } = state;
  return responseBuilders[phase](state);
}

/* eslint-disable @typescript-eslint/explicit-function-return-type -- LangGraph complex generics */
function createGraphBuilder() {
  return new StateGraph(searchStateAnnotation)
    .addNode(NODE.load_context, loadContextNode)
    .addNode(NODE.check_goal, checkGoalNode)
    .addNode(NODE.explore, exploreNode)
    .addNode(NODE.show_exploration, showExplorationNode)
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
    .addNode(NODE.cancel, cancelNode)

    .addEdge(START, NODE.load_context)
    .addEdge(NODE.load_context, NODE.check_goal)
    .addConditionalEdges(NODE.check_goal, routeAfterCheckGoal, buildRouteMap([NODE.search, NODE.explore]))
    .addEdge(NODE.explore, NODE.show_exploration)
    .addConditionalEdges(
      NODE.show_exploration,
      routeAfterShowExploration,
      buildRouteMap([NODE.extract_goal, NODE.cancel]),
    )
    .addEdge(NODE.extract_goal, NODE.show_goal)
    .addConditionalEdges(
      NODE.show_goal,
      routeAfterShowGoal,
      buildRouteMap([NODE.validate_goal, NODE.clarify_goal, NODE.set_goal, NODE.cancel]),
    )
    .addEdge(NODE.clarify_goal, NODE.show_goal)
    .addEdge(NODE.validate_goal, NODE.ask_after_validate)
    .addConditionalEdges(
      NODE.ask_after_validate,
      routeAfterAskAfterValidate,
      buildRouteMap([NODE.set_goal, NODE.extract_goal, NODE.cancel]),
    )
    .addEdge(NODE.set_goal, NODE.search)
    .addEdge(NODE.search, NODE.show_results)
    .addConditionalEdges(
      NODE.show_results,
      routeAfterShowResults,
      buildRouteMap([NODE.load_existing_goal, NODE.delete_goal, NODE.cancel]),
    )
    .addEdge(NODE.load_existing_goal, NODE.show_goal)
    .addEdge(NODE.delete_goal, NODE.explore)
    .addEdge(NODE.cancel, END);
}
/* eslint-enable @typescript-eslint/explicit-function-return-type */

type CompiledGraph = ReturnType<ReturnType<typeof createGraphBuilder>["compile"]>;

function isSearchState(values: unknown): values is SearchStateType {
  if (!values || typeof values !== "object") return false;
  return "phase" in values && "userId" in values;
}

function toSearchState(values: unknown): SearchStateType {
  if (!isSearchState(values)) {
    throw new AgentInvariantError("toSearchState", "Invalid state values from graph");
  }
  return values;
}

function extractInterruptPhase(snapshot: StateSnapshot): SearchPhase | undefined {
  const task = snapshot.tasks[0];
  if (!task) return undefined;

  const interrupt = task.interrupts[0];
  if (!interrupt) return undefined;

  const parsed = interruptValueSchema.safeParse(interrupt.value);
  if (!parsed.success) return undefined;

  const phaseValue = parsed.data.phase;
  if (!phaseValue) return undefined;
  /* eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- LangGraph interrupt phase is untyped */
  return phaseValue as SearchPhase;
}

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
    /* eslint-disable @typescript-eslint/naming-convention -- LangGraph API */
    const config = { configurable: { thread_id: threadId, ...this.deps } };
    /* eslint-enable @typescript-eslint/naming-convention */

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

    if (interruptPhase) {
      const values = toSearchState(finalSnapshot.values);
      return stateToResponse({ ...values, phase: interruptPhase });
    }

    return stateToResponse(result);
  }
}

export { PHASE } from "./state.js";
