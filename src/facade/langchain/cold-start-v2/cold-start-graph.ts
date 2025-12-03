import { Command, END, START, StateGraph } from "@langchain/langgraph";
import { z } from "zod";

import { AgentInvariantError } from "../../errors.js";
import { postgresService } from "../../infrastructure/postgres.service.js";
import { responseBuilders } from "../cold-start/response-builders.js";
import { coldStartPhaseSchema } from "../cold-start/types.js";

import {
  cancelNode,
  clarifyNode,
  editContextNode,
  extractContextNode,
  gatherStoryNode,
  nextContextNode,
  parseDecisionNode,
  parseStoryDecisionNode,
  persistNode,
  planCareerNode,
  showContextNode,
  showFinalNode,
  showPlanNode,
  validateContextNode,
} from "./nodes/index.js";
import {
  routeAfterContextDecision,
  routeAfterFinalDecision,
  routeAfterPlanDecision,
  routeAfterStoryDecision,
  routeAfterValidation,
} from "./routers/index.js";
import { coldStartStateAnnotation } from "./state.js";

import type { ColdStartStateType, UserId } from "./state.js";
import type { ColdStartPhase, ColdStartResponse, ColdStartState } from "../cold-start/types.js";
import type { StateSnapshot } from "@langchain/langgraph";

export { PHASE } from "./state.js";

const interruptValueSchema = z.object({
  phase: coldStartPhaseSchema.optional(),
});

function stateToResponse(state: ColdStartStateType): ColdStartResponse {
  const { phase } = state;
  const coldStartState: ColdStartState = {
    messages: state.messages,
    phase: state.phase,
    queue: state.queue,
    collectedContexts: state.collectedContexts,
    collectedTrails: state.collectedTrails,
    missingFields: state.missingFields,
    clarificationRound: state.clarificationRound,
    currentEntityContext: state.currentEntityContext,
    userId: state.userId,
    userResponse: state.userResponse,
  };

  return responseBuilders[phase](coldStartState);
}

/* eslint-disable @typescript-eslint/naming-convention, @typescript-eslint/explicit-function-return-type -- LangGraph complex generics */
function createGraphBuilder() {
  return new StateGraph(coldStartStateAnnotation)
    .addNode("gather_story", gatherStoryNode)
    .addNode("parse_story_decision", parseStoryDecisionNode)
    .addNode("plan_career", planCareerNode)
    .addNode("show_plan", showPlanNode)
    .addNode("parse_plan_decision", parseDecisionNode)
    .addNode("extract_context", extractContextNode)
    .addNode("validate_context", validateContextNode)
    .addNode("clarify", clarifyNode)
    .addNode("show_context", showContextNode)
    .addNode("parse_context_decision", parseDecisionNode)
    .addNode("edit_context", editContextNode)
    .addNode("next_context", nextContextNode)
    .addNode("show_final", showFinalNode)
    .addNode("parse_final_decision", parseDecisionNode)
    .addNode("persist", persistNode)
    .addNode("cancel", cancelNode)
    .addEdge(START, "gather_story")
    .addEdge("gather_story", "parse_story_decision")
    .addConditionalEdges("parse_story_decision", routeAfterStoryDecision, {
      plan_career: "plan_career",
      gather_story: "gather_story",
      cancel: "cancel",
    })
    .addEdge("plan_career", "show_plan")
    .addEdge("show_plan", "parse_plan_decision")
    .addConditionalEdges("parse_plan_decision", routeAfterPlanDecision, {
      extract_context: "extract_context",
      gather_story: "gather_story",
      cancel: "cancel",
      show_plan: "show_plan",
    })
    .addEdge("extract_context", "validate_context")
    .addConditionalEdges("validate_context", routeAfterValidation, {
      clarify: "clarify",
      show_context: "show_context",
      cancel: "cancel",
    })
    .addEdge("clarify", "extract_context")
    .addEdge("show_context", "parse_context_decision")
    .addConditionalEdges("parse_context_decision", routeAfterContextDecision, {
      next_context: "next_context",
      show_final: "show_final",
      edit_context: "edit_context",
      cancel: "cancel",
      show_context: "show_context",
    })
    .addEdge("edit_context", "show_context")
    .addEdge("next_context", "extract_context")
    .addEdge("show_final", "parse_final_decision")
    .addConditionalEdges("parse_final_decision", routeAfterFinalDecision, {
      persist: "persist",
      show_context: "show_context",
      cancel: "cancel",
      show_final: "show_final",
    })
    .addEdge("persist", END)
    .addEdge("cancel", END);
}
/* eslint-enable @typescript-eslint/naming-convention, @typescript-eslint/explicit-function-return-type */

type CompiledGraph = ReturnType<ReturnType<typeof createGraphBuilder>["compile"]>;

let compiledGraphCache: CompiledGraph | null = null;

function isColdStartState(values: unknown): values is ColdStartStateType {
  if (!values || typeof values !== "object") return false;
  return "phase" in values && "messages" in values && "queue" in values;
}

function toColdStartState(values: unknown): ColdStartStateType {
  if (!isColdStartState(values)) {
    throw new AgentInvariantError("toColdStartState", "Invalid state values from graph");
  }
  return values;
}

function extractInterruptPhase(snapshot: StateSnapshot): ColdStartPhase | undefined {
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

export class ColdStartGraph {
  private readonly userId: UserId;

  constructor(userId: UserId) {
    this.userId = userId;
  }

  async run(message: string, threadId: string): Promise<ColdStartResponse> {
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
      const values = toColdStartState(finalSnapshot.values);
      return stateToResponse({ ...values, phase: interruptPhase });
    }

    return stateToResponse(result);
  }
}

export function resetCheckpointer(): void {
  compiledGraphCache = null;
}
