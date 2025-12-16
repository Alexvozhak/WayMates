import { Command, END, START, StateGraph } from "@langchain/langgraph";
import { z } from "zod";

import { AgentInvariantError } from "../../errors.js";

import { cancelNode } from "./nodes/cancel.js";
import { clarifyNode } from "./nodes/clarify.js";
import { editTrailNode } from "./nodes/edit-trail.js";
import { extractTrailNode } from "./nodes/extract-trail.js";
import { parseDecisionNode } from "./nodes/parse-decision.js";
import { persistTrailNode } from "./nodes/persist-trail.js";
import { showTrailNode } from "./nodes/show-trail.js";
import { validateTrailNode } from "./nodes/validate-trail.js";
import { responseBuilders } from "./response-builders.js";
import { NODE, PHASE, upsertTrailStateAnnotation } from "./state.js";
import { routeAfterDecision, routeAfterValidation } from "./trail-router.js";

import type { UpsertTrailPhase, UpsertTrailStateType } from "./state.js";
import type { UpsertTrailResponse } from "./types.js";
import type { ContextId, UserId } from "../../../shared/schemas.js";
import type { GraphDeps } from "../shared/types.js";
import type { StateSnapshot } from "@langchain/langgraph";

const interruptValueSchema = z.object({
  phase: z
    .enum([
      PHASE.extracting,
      PHASE.awaitingClarification,
      PHASE.awaitingConfirmation,
      PHASE.saved,
      PHASE.cancelled,
      PHASE.failed,
    ])
    .optional(),
});

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
    .addConditionalEdges(NODE.validate_trail, routeAfterValidation, {
      [NODE.clarify]: NODE.clarify,
      [NODE.show_trail]: NODE.show_trail,
      [NODE.cancel]: NODE.cancel,
    })
    .addEdge(NODE.clarify, NODE.extract_trail)
    .addEdge(NODE.show_trail, NODE.parse_decision)
    .addConditionalEdges(NODE.parse_decision, routeAfterDecision, {
      [NODE.persist_trail]: NODE.persist_trail,
      [NODE.edit_trail]: NODE.edit_trail,
      [NODE.cancel]: NODE.cancel,
      [NODE.show_trail]: NODE.show_trail,
    })
    .addEdge(NODE.edit_trail, NODE.validate_trail)
    .addEdge(NODE.persist_trail, END)
    .addEdge(NODE.cancel, END);
}
/* eslint-enable @typescript-eslint/explicit-function-return-type */

type CompiledGraph = ReturnType<ReturnType<typeof createGraphBuilder>["compile"]>;

function isUpsertTrailState(values: unknown): values is UpsertTrailStateType {
  if (!values || typeof values !== "object") return false;
  return "phase" in values && "userId" in values;
}

function toUpsertTrailState(values: unknown): UpsertTrailStateType {
  if (!isUpsertTrailState(values)) {
    throw new AgentInvariantError("toUpsertTrailState", "Invalid state values from graph");
  }
  return values;
}

function extractInterruptPhase(snapshot: StateSnapshot): UpsertTrailPhase | undefined {
  const task = snapshot.tasks[0];
  if (!task) return undefined;

  const interrupt = task.interrupts[0];
  if (!interrupt) return undefined;

  const parsed = interruptValueSchema.safeParse(interrupt.value);
  if (!parsed.success) return undefined;

  return parsed.data.phase;
}

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
  ): Promise<UpsertTrailResponse> {
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
            fromContextId,
            userResponse: message,
          },
          config,
        );

    const finalSnapshot = await this.compiledGraph.getState(config);
    const interruptPhase = extractInterruptPhase(finalSnapshot);

    if (interruptPhase) {
      const values = toUpsertTrailState(finalSnapshot.values);
      return stateToResponse({ ...values, phase: interruptPhase });
    }

    return stateToResponse(result);
  }
}

export { PHASE } from "./state.js";
