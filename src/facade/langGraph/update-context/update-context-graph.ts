import { Command, END, START, StateGraph } from "@langchain/langgraph";
import { z } from "zod";

import { AgentInvariantError } from "../../errors.js";

import { cancelNode } from "./nodes/cancel.js";
import { editUpdateNode } from "./nodes/edit-update.js";
import { extractUpdatesNode } from "./nodes/extract-updates.js";
import { mergeContextNode } from "./nodes/merge-context.js";
import { parseDecisionNode } from "./nodes/parse-decision.js";
import { persistUpdateNode } from "./nodes/persist-update.js";
import { showUpdateNode } from "./nodes/show-update.js";
import { responseBuilders } from "./response-builders.js";
import { PHASE, updateContextStateAnnotation } from "./state.js";
import { routeAfterDecision, routeAfterMerge } from "./update-router.js";

import type { UpdateContextPhase, UpdateContextStateType } from "./state.js";
import type { UpdateContextResponse } from "./types.js";
import type { UserContext, UserId } from "../../../shared/schemas.js";
import type { CoreClient } from "../../core-client.js";
import type { Normalizer } from "../../services/normalizer.js";
import type { StateSnapshot } from "@langchain/langgraph";
import type { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";

const interruptValueSchema = z.object({
  phase: z.enum([PHASE.extracting, PHASE.awaitingConfirmation, PHASE.saved, PHASE.cancelled, PHASE.failed]).optional(),
});

function stateToResponse(state: UpdateContextStateType): UpdateContextResponse {
  const { phase } = state;
  return responseBuilders[phase](state);
}

/* eslint-disable @typescript-eslint/naming-convention, @typescript-eslint/explicit-function-return-type -- LangGraph complex generics */
function createGraphBuilder() {
  return new StateGraph(updateContextStateAnnotation)
    .addNode("extract_updates", extractUpdatesNode)
    .addNode("merge_context", mergeContextNode)
    .addNode("show_update", showUpdateNode)
    .addNode("parse_decision", parseDecisionNode)
    .addNode("edit_update", editUpdateNode)
    .addNode("persist_update", persistUpdateNode)
    .addNode("cancel", cancelNode)

    .addEdge(START, "extract_updates")
    .addEdge("extract_updates", "merge_context")
    .addConditionalEdges("merge_context", routeAfterMerge, {
      show_update: "show_update",
      cancel: "cancel",
    })
    .addEdge("show_update", "parse_decision")
    .addConditionalEdges("parse_decision", routeAfterDecision, {
      persist_update: "persist_update",
      edit_update: "edit_update",
      cancel: "cancel",
      show_update: "show_update",
    })
    .addEdge("edit_update", "merge_context")
    .addEdge("persist_update", END)
    .addEdge("cancel", END);
}
/* eslint-enable @typescript-eslint/naming-convention, @typescript-eslint/explicit-function-return-type */

type CompiledGraph = ReturnType<ReturnType<typeof createGraphBuilder>["compile"]>;

function isUpdateContextState(values: unknown): values is UpdateContextStateType {
  if (!values || typeof values !== "object") return false;
  return "phase" in values && "userId" in values;
}

function toUpdateContextState(values: unknown): UpdateContextStateType {
  if (!isUpdateContextState(values)) {
    throw new AgentInvariantError("toUpdateContextState", "Invalid state values from graph");
  }
  return values;
}

function extractInterruptPhase(snapshot: StateSnapshot): UpdateContextPhase | undefined {
  const task = snapshot.tasks[0];
  if (!task) return undefined;

  const interrupt = task.interrupts[0];
  if (!interrupt) return undefined;

  const parsed = interruptValueSchema.safeParse(interrupt.value);
  if (!parsed.success) return undefined;

  return parsed.data.phase;
}

export class UpdateContextGraph {
  private readonly compiledGraph: CompiledGraph;

  constructor(
    private readonly userId: UserId,
    private readonly currentContext: UserContext,
    checkpointer: PostgresSaver,
  ) {
    this.compiledGraph = createGraphBuilder().compile({ checkpointer });
  }

  async run(
    message: string,
    threadId: string,
    coreClient: CoreClient,
    normalizer: Normalizer,
  ): Promise<UpdateContextResponse> {
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
            currentContext: this.currentContext,
            userResponse: message,
          },
          config,
        );

    const finalSnapshot = await this.compiledGraph.getState(config);
    const interruptPhase = extractInterruptPhase(finalSnapshot);

    if (interruptPhase) {
      const values = toUpdateContextState(finalSnapshot.values);
      return stateToResponse({ ...values, phase: interruptPhase });
    }

    return stateToResponse(result);
  }
}

export { PHASE } from "./state.js";
