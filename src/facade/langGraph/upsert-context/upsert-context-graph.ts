import { Command, END, START, StateGraph } from "@langchain/langgraph";
import { z } from "zod";

import { AgentInvariantError } from "../../errors.js";

import { routeAfterDecision, routeAfterValidation } from "./context-router.js";
import { cancelNode } from "./nodes/cancel.js";
import { clarifyNode } from "./nodes/clarify.js";
import { editContextNode } from "./nodes/edit-context.js";
import { extractContextNode } from "./nodes/extract-context.js";
import { parseDecisionNode } from "./nodes/parse-decision.js";
import { persistContextNode } from "./nodes/persist-context.js";
import { showContextNode } from "./nodes/show-context.js";
import { validateContextNode } from "./nodes/validate-context.js";
import { responseBuilders } from "./response-builders.js";
import { PHASE, upsertContextStateAnnotation } from "./state.js";

import type { UpsertContextPhase, UpsertContextStateType } from "./state.js";
import type { UpsertContextResponse } from "./types.js";
import type { UserId } from "../../../shared/schemas.js";
import type { CoreClient } from "../../core-client.js";
import type { Normalizer } from "../../services/normalizer.js";
import type { StateSnapshot } from "@langchain/langgraph";
import type { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";

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

function stateToResponse(state: UpsertContextStateType): UpsertContextResponse {
  const { phase } = state;
  return responseBuilders[phase](state);
}

/* eslint-disable @typescript-eslint/naming-convention, @typescript-eslint/explicit-function-return-type -- LangGraph complex generics */
function createGraphBuilder() {
  return new StateGraph(upsertContextStateAnnotation)
    .addNode("extract_context", extractContextNode)
    .addNode("validate_context", validateContextNode)
    .addNode("clarify", clarifyNode)
    .addNode("show_context", showContextNode)
    .addNode("parse_decision", parseDecisionNode)
    .addNode("edit_context", editContextNode)
    .addNode("persist_context", persistContextNode)
    .addNode("cancel", cancelNode)

    .addEdge(START, "extract_context")
    .addEdge("extract_context", "validate_context")
    .addConditionalEdges("validate_context", routeAfterValidation, {
      clarify: "clarify",
      show_context: "show_context",
      cancel: "cancel",
    })
    .addEdge("clarify", "extract_context")
    .addEdge("show_context", "parse_decision")
    .addConditionalEdges("parse_decision", routeAfterDecision, {
      persist_context: "persist_context",
      edit_context: "edit_context",
      cancel: "cancel",
      show_context: "show_context",
    })
    .addEdge("edit_context", "validate_context")
    .addEdge("persist_context", END)
    .addEdge("cancel", END);
}
/* eslint-enable @typescript-eslint/naming-convention, @typescript-eslint/explicit-function-return-type */

type CompiledGraph = ReturnType<ReturnType<typeof createGraphBuilder>["compile"]>;

function isUpsertContextState(values: unknown): values is UpsertContextStateType {
  if (!values || typeof values !== "object") return false;
  return "phase" in values && "userId" in values;
}

function toUpsertContextState(values: unknown): UpsertContextStateType {
  if (!isUpsertContextState(values)) {
    throw new AgentInvariantError("toUpsertContextState", "Invalid state values from graph");
  }
  return values;
}

function extractInterruptPhase(snapshot: StateSnapshot): UpsertContextPhase | undefined {
  const task = snapshot.tasks[0];
  if (!task) return undefined;

  const interrupt = task.interrupts[0];
  if (!interrupt) return undefined;

  const parsed = interruptValueSchema.safeParse(interrupt.value);
  if (!parsed.success) return undefined;

  return parsed.data.phase;
}

export class UpsertContextGraph {
  private readonly compiledGraph: CompiledGraph;

  constructor(
    private readonly userId: UserId,
    checkpointer: PostgresSaver,
  ) {
    this.compiledGraph = createGraphBuilder().compile({ checkpointer });
  }

  async run(
    message: string,
    threadId: string,
    coreClient: CoreClient,
    normalizer: Normalizer,
  ): Promise<UpsertContextResponse> {
    /* eslint-disable @typescript-eslint/naming-convention -- LangGraph API */
    const config = { configurable: { thread_id: threadId, coreClient, normalizer } };
    /* eslint-enable @typescript-eslint/naming-convention */

    const currentSnapshot = await this.compiledGraph.getState(config);
    const hasPendingInterrupt = currentSnapshot.tasks.length > 0;

    const result = hasPendingInterrupt
      ? await this.compiledGraph.invoke(new Command({ resume: message }), config)
      : await this.compiledGraph.invoke(
          {
            userId: this.userId,
            userResponse: message,
          },
          config,
        );

    const finalSnapshot = await this.compiledGraph.getState(config);
    const interruptPhase = extractInterruptPhase(finalSnapshot);

    if (interruptPhase) {
      const values = toUpsertContextState(finalSnapshot.values);
      return stateToResponse({ ...values, phase: interruptPhase });
    }

    return stateToResponse(result);
  }
}

export { PHASE } from "./state.js";
