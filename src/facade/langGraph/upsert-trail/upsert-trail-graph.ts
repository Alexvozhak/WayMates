import { Command, END, START, StateGraph } from "@langchain/langgraph";

import { createInterruptPhaseExtractor } from "../shared/interrupt-utils.js";
import { isGraphState } from "../shared/state-utils.js";

import { cancelNode } from "./nodes/cancel.js";
import { clarifyNode } from "./nodes/clarify.js";
import { editTrailNode } from "./nodes/edit-trail.js";
import { extractTrailNode } from "./nodes/extract-trail.js";
import { parseDecisionNode } from "./nodes/parse-decision.js";
import { persistTrailNode } from "./nodes/persist-trail.js";
import { showTrailNode } from "./nodes/show-trail.js";
import { validateTrailNode } from "./nodes/validate-trail.js";
import { responseBuilders } from "./response-builders.js";
import { NODE, phaseSchema, upsertTrailStateAnnotation } from "./state.js";
import { DECISION_ROUTE_MAP, routeAfterDecision, routeAfterValidation, VALIDATION_ROUTE_MAP } from "./trail-router.js";

import type { UpsertTrailStateType } from "./state.js";
import type { UpsertTrailResponse } from "./types.js";
import type { ContextId, Locale, UserId } from "../../../shared/schemas.js";
import type { GraphDeps } from "../shared/types.js";

const extractInterruptPhase = createInterruptPhaseExtractor(phaseSchema);

function stateToResponse(state: UpsertTrailStateType): UpsertTrailResponse {
  const { phase } = state;
  return responseBuilders[phase](state);
}

/* eslint-disable @typescript-eslint/explicit-function-return-type -- LangGraph complex generics */
export function createGraphBuilder() {
  return new StateGraph(upsertTrailStateAnnotation)
    .addNode(NODE.extract_trail, extractTrailNode)
    .addNode(NODE.validate_trail, validateTrailNode)
    .addNode(NODE.clarify, clarifyNode)
    .addNode(NODE.show_trail, showTrailNode)
    .addNode(NODE.parse_decision, parseDecisionNode)
    .addNode(NODE.edit_trail, editTrailNode)
    .addNode(NODE.persist_trail, persistTrailNode)
    .addNode(NODE.cancel, cancelNode)

    .addEdge(START, NODE.extract_trail)
    .addEdge(NODE.extract_trail, NODE.validate_trail)
    .addConditionalEdges(NODE.validate_trail, routeAfterValidation, VALIDATION_ROUTE_MAP)
    .addEdge(NODE.clarify, NODE.extract_trail)
    .addEdge(NODE.show_trail, NODE.parse_decision)
    .addConditionalEdges(NODE.parse_decision, routeAfterDecision, DECISION_ROUTE_MAP)
    .addEdge(NODE.edit_trail, NODE.validate_trail)
    .addEdge(NODE.persist_trail, END)
    .addEdge(NODE.cancel, END);
}
/* eslint-enable @typescript-eslint/explicit-function-return-type */

type CompiledGraph = ReturnType<ReturnType<typeof createGraphBuilder>["compile"]>;

export class UpsertTrailGraph {
  private readonly compiledGraph: CompiledGraph;

  constructor(private readonly deps: GraphDeps) {
    this.compiledGraph = createGraphBuilder().compile({ checkpointer: deps.checkpointService.getCheckpointer() });
  }

  async run(
    message: string,
    threadId: string,
    userId: UserId,
    fromContextId: ContextId | null,
    locale: Locale,
  ): Promise<UpsertTrailResponse> {
    const config = { configurable: { thread_id: threadId, ...this.deps } };

    const currentSnapshot = await this.compiledGraph.getState(config);
    const hasPendingInterrupt = currentSnapshot.tasks.length > 0;

    const result = hasPendingInterrupt
      ? await this.compiledGraph.invoke(new Command({ resume: message }), config)
      : await this.compiledGraph.invoke(
          {
            userId,
            locale,
            fromContextId,
            userResponse: message,
          },
          config,
        );

    const finalSnapshot = await this.compiledGraph.getState(config);
    const interruptPhase = extractInterruptPhase(finalSnapshot);

    if (interruptPhase && isGraphState<UpsertTrailStateType>(finalSnapshot.values)) {
      return stateToResponse({ ...finalSnapshot.values, phase: interruptPhase });
    }

    return stateToResponse(result);
  }
}

export { PHASE } from "./state.js";
