import { Command, END, START, StateGraph } from "@langchain/langgraph";
import { z } from "zod";

import { AgentInvariantError } from "../../errors.js";
import { postgresService } from "../../infrastructure/postgres.service.js";

import {
  cancelNode,
  editTrailNode,
  extractTrailNode,
  parseDecisionNode,
  persistTrailNode,
  showTrailNode,
  validateTrailNode,
} from "./nodes/index.js";
import { responseBuilders } from "./response-builders.js";
import { routeAfterDecision, routeAfterValidation } from "./routers/index.js";
import { PHASE, upsertTrailStateAnnotation } from "./state.js";

import type { UpsertTrailPhase, UpsertTrailStateType } from "./state.js";
import type { UpsertTrailResponse } from "./types.js";
import type { ContextId, UserId } from "../../../shared/schemas.js";
import type { StateSnapshot } from "@langchain/langgraph";

const interruptValueSchema = z.object({
  phase: z
    .enum([PHASE.extracting, PHASE.awaitingConfirmation, PHASE.approved, PHASE.cancelled, PHASE.failed])
    .optional(),
});

function stateToResponse(state: UpsertTrailStateType): UpsertTrailResponse {
  const { phase } = state;
  return responseBuilders[phase](state);
}

/* eslint-disable @typescript-eslint/naming-convention, @typescript-eslint/explicit-function-return-type -- LangGraph complex generics */
function createGraphBuilder() {
  return new StateGraph(upsertTrailStateAnnotation)
    .addNode("extract_trail", extractTrailNode)
    .addNode("validate_trail", validateTrailNode)
    .addNode("show_trail", showTrailNode)
    .addNode("parse_decision", parseDecisionNode)
    .addNode("edit_trail", editTrailNode)
    .addNode("persist_trail", persistTrailNode)
    .addNode("cancel", cancelNode)

    .addEdge(START, "extract_trail")
    .addEdge("extract_trail", "validate_trail")
    .addConditionalEdges("validate_trail", routeAfterValidation, {
      show_trail: "show_trail",
      cancel: "cancel",
    })
    .addEdge("show_trail", "parse_decision")
    .addConditionalEdges("parse_decision", routeAfterDecision, {
      persist_trail: "persist_trail",
      edit_trail: "edit_trail",
      cancel: "cancel",
      show_trail: "show_trail",
    })
    .addEdge("edit_trail", "validate_trail")
    .addEdge("persist_trail", END)
    .addEdge("cancel", END);
}
/* eslint-enable @typescript-eslint/naming-convention, @typescript-eslint/explicit-function-return-type */

type CompiledGraph = ReturnType<ReturnType<typeof createGraphBuilder>["compile"]>;

let compiledGraphCache: CompiledGraph | null = null;

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

function getCompiledGraph(): CompiledGraph {
  if (!compiledGraphCache) {
    const checkpointer = postgresService.getCheckpointer();
    compiledGraphCache = createGraphBuilder().compile({ checkpointer });
  }
  return compiledGraphCache;
}

export class UpsertTrailGraph {
  constructor(
    private readonly userId: UserId,
    private readonly fromContextId: ContextId | null,
  ) {}

  async run(message: string, threadId: string): Promise<UpsertTrailResponse> {
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
            fromContextId: this.fromContextId,
            userResponse: message,
          },
          config,
        );

    const finalSnapshot = await graph.getState(config);
    const interruptPhase = extractInterruptPhase(finalSnapshot);

    if (interruptPhase) {
      const values = toUpsertTrailState(finalSnapshot.values);
      return stateToResponse({ ...values, phase: interruptPhase });
    }

    return stateToResponse(result);
  }
}

export function resetCheckpointer(): void {
  compiledGraphCache = null;
}
