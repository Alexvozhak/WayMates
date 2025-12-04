import { Command, END, START, StateGraph } from "@langchain/langgraph";
import { z } from "zod";

import { AgentInvariantError } from "../../errors.js";
import { postgresService } from "../../infrastructure/postgres.service.js";

import {
  cancelNode,
  editContextNode,
  extractContextNode,
  parseDecisionNode,
  persistContextNode,
  showContextNode,
  validateContextNode,
} from "./nodes/index.js";
import { responseBuilders } from "./response-builders.js";
import { routeAfterDecision, routeAfterValidation } from "./routers/index.js";
import { PHASE, upsertContextStateAnnotation } from "./state.js";

import type { UpsertContextPhase, UpsertContextStateType } from "./state.js";
import type { UpsertContextResponse } from "./types.js";
import type { UserId } from "../../../shared/schemas.js";
import type { StateSnapshot } from "@langchain/langgraph";

const interruptValueSchema = z.object({
  phase: z
    .enum([PHASE.extracting, PHASE.awaitingConfirmation, PHASE.approved, PHASE.cancelled, PHASE.failed])
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
    .addNode("show_context", showContextNode)
    .addNode("parse_decision", parseDecisionNode)
    .addNode("edit_context", editContextNode)
    .addNode("persist_context", persistContextNode)
    .addNode("cancel", cancelNode)

    .addEdge(START, "extract_context")
    .addEdge("extract_context", "validate_context")
    .addConditionalEdges("validate_context", routeAfterValidation, {
      show_context: "show_context",
      cancel: "cancel",
    })
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

let compiledGraphCache: CompiledGraph | null = null;

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

function getCompiledGraph(): CompiledGraph {
  if (!compiledGraphCache) {
    const checkpointer = postgresService.getCheckpointer();
    compiledGraphCache = createGraphBuilder().compile({ checkpointer });
  }
  return compiledGraphCache;
}

export class UpsertContextGraph {
  constructor(private readonly userId: UserId) {}

  async run(message: string, threadId: string): Promise<UpsertContextResponse> {
    const graph = getCompiledGraph();
    /* eslint-disable @typescript-eslint/naming-convention -- LangGraph API */
    const config = { configurable: { thread_id: threadId } };
    /* eslint-enable @typescript-eslint/naming-convention */

    const currentSnapshot = await graph.getState(config);
    const hasPendingInterrupt = currentSnapshot.tasks.length > 0;

    const result = hasPendingInterrupt
      ? await graph.invoke(new Command({ resume: message }), config)
      : await graph.invoke(
          {
            userId: this.userId,
            userResponse: message,
          },
          config,
        );

    const finalSnapshot = await graph.getState(config);
    const interruptPhase = extractInterruptPhase(finalSnapshot);

    if (interruptPhase) {
      const values = toUpsertContextState(finalSnapshot.values);
      return stateToResponse({ ...values, phase: interruptPhase });
    }

    return stateToResponse(result);
  }
}

export function resetCheckpointer(): void {
  compiledGraphCache = null;
}
