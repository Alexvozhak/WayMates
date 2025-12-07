import { Command, END, START, StateGraph } from "@langchain/langgraph";
import { z } from "zod";

import { AgentInvariantError } from "../../errors.js";

import {
  routeAfterContextDecision,
  routeAfterFinalDecision,
  routeAfterPlanDecision,
  routeAfterStoryDecision,
  routeAfterValidation,
} from "./decision-router.js";
import { cancelNode } from "./nodes/cancel.js";
import { clarifyNode } from "./nodes/clarify.js";
import { editContextNode } from "./nodes/edit-context.js";
import { extractContextNode } from "./nodes/extract-context.js";
import { gatherStoryNode } from "./nodes/gather-story.js";
import { nextContextNode } from "./nodes/next-context.js";
import { parseDecisionNode, parseStoryDecisionNode } from "./nodes/parse-decision.js";
import { persistNode } from "./nodes/persist.js";
import { planCareerNode } from "./nodes/plan-career.js";
import { showContextNode } from "./nodes/show-context.js";
import { showFinalNode } from "./nodes/show-final.js";
import { showPlanNode } from "./nodes/show-plan.js";
import { validateContextNode } from "./nodes/validate-context.js";
import { responseBuilders } from "./response-builders.js";
import { coldStartStateAnnotation } from "./state.js";
import { coldStartPhaseSchema } from "./types.js";

import type { ColdStartStateType, UserId } from "./state.js";
import type { ColdStartPhase, ColdStartResponse, ColdStartState } from "./types.js";
import type { CoreClient } from "../../core-client.js";
import type { Normalizer } from "../../services/normalizer.js";
import type { UserService } from "../../services/user.service.js";
import type { StateSnapshot } from "@langchain/langgraph";
import type { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";

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

export class ColdStartGraph {
  private readonly userId: UserId;
  private readonly compiledGraph: CompiledGraph;

  constructor(userId: UserId, checkpointer: PostgresSaver) {
    this.userId = userId;
    this.compiledGraph = createGraphBuilder().compile({ checkpointer });
  }

  async run(
    message: string,
    threadId: string,
    coreClient: CoreClient,
    normalizer: Normalizer,
    userService: UserService,
  ): Promise<ColdStartResponse> {
    /* eslint-disable @typescript-eslint/naming-convention -- LangGraph API */
    const config = { configurable: { thread_id: threadId, coreClient, normalizer, userService } };
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
      const values = toColdStartState(finalSnapshot.values);
      return stateToResponse({ ...values, phase: interruptPhase });
    }

    return stateToResponse(result);
  }
}
