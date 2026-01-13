import { Command, END, START, StateGraph } from "@langchain/langgraph";

import { createInterruptPhaseExtractor } from "../shared/interrupt-utils.js";
import { isGraphState } from "../shared/state-utils.js";

import {
  DECISION_ROUTE_MAP,
  routeAfterDecision,
  routeAfterValidation,
  VALIDATION_ROUTE_MAP,
} from "./context-router.js";
import { cancelNode } from "./nodes/cancel.js";
import { clarifyNode } from "./nodes/clarify.js";
import { editContextNode } from "./nodes/edit-context.js";
import { extractContextNode } from "./nodes/extract-context.js";
import { parseDecisionNode } from "./nodes/parse-decision.js";
import { persistContextNode } from "./nodes/persist-context.js";
import { showContextNode } from "./nodes/show-context.js";
import { validateContextNode } from "./nodes/validate-context.js";
import { responseBuilders } from "./response-builders.js";
import { NODE, phaseSchema, upsertContextStateAnnotation } from "./state.js";

import type { UpsertContextStateType } from "./state.js";
import type { UpsertContextResponse } from "./types.js";
import type { Locale, UserId } from "../../../../private/schemas.js";
import type { GraphDeps } from "../shared/types.js";

const extractInterruptPhase = createInterruptPhaseExtractor(phaseSchema);

function stateToResponse(state: UpsertContextStateType): UpsertContextResponse {
  const { phase } = state;
  return responseBuilders[phase](state);
}

/* eslint-disable @typescript-eslint/explicit-function-return-type -- LangGraph complex generics */
export function createGraphBuilder() {
  return new StateGraph(upsertContextStateAnnotation)
    .addNode(NODE.extract_context, extractContextNode)
    .addNode(NODE.validate_context, validateContextNode)
    .addNode(NODE.clarify, clarifyNode)
    .addNode(NODE.show_context, showContextNode)
    .addNode(NODE.parse_decision, parseDecisionNode)
    .addNode(NODE.edit_context, editContextNode)
    .addNode(NODE.persist_context, persistContextNode)
    .addNode(NODE.cancel, cancelNode)

    .addEdge(START, NODE.extract_context)
    .addEdge(NODE.extract_context, NODE.validate_context)
    .addConditionalEdges(NODE.validate_context, routeAfterValidation, VALIDATION_ROUTE_MAP)
    .addEdge(NODE.clarify, NODE.extract_context)
    .addEdge(NODE.show_context, NODE.parse_decision)
    .addConditionalEdges(NODE.parse_decision, routeAfterDecision, DECISION_ROUTE_MAP)
    .addEdge(NODE.edit_context, NODE.validate_context)
    .addEdge(NODE.persist_context, END)
    .addEdge(NODE.cancel, END);
}
/* eslint-enable @typescript-eslint/explicit-function-return-type */

type CompiledGraph = ReturnType<ReturnType<typeof createGraphBuilder>["compile"]>;

export class UpsertContextGraph {
  private readonly compiledGraph: CompiledGraph;

  constructor(private readonly deps: GraphDeps) {
    this.compiledGraph = createGraphBuilder().compile({ checkpointer: deps.checkpointService.getCheckpointer() });
  }

  async run(message: string, threadId: string, userId: UserId, locale: Locale): Promise<UpsertContextResponse> {
    const config = { configurable: { thread_id: threadId, ...this.deps } };

    const currentSnapshot = await this.compiledGraph.getState(config);
    const hasPendingInterrupt = currentSnapshot.tasks.length > 0;

    const result = hasPendingInterrupt
      ? await this.compiledGraph.invoke(new Command({ resume: message }), config)
      : await this.compiledGraph.invoke(
          {
            userId,
            locale,
            userResponse: message,
          },
          config,
        );

    const finalSnapshot = await this.compiledGraph.getState(config);
    const interruptPhase = extractInterruptPhase(finalSnapshot);

    if (interruptPhase && isGraphState<UpsertContextStateType>(finalSnapshot.values)) {
      return stateToResponse({ ...finalSnapshot.values, phase: interruptPhase });
    }

    return stateToResponse(result);
  }
}

export { PHASE } from "./state.js";
