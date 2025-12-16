import { Command, END, START, StateGraph } from "@langchain/langgraph";
import { z } from "zod";

import { AgentInvariantError } from "../../errors.js";

import {
  routeAfterContextDecision,
  routeAfterFinalDecision,
  routeAfterPlanCareer,
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
import { parseConfirmationNode } from "./nodes/parse-confirmation.js";
import { parseStoryCompletionNode } from "./nodes/parse-story-completion.js";
import { persistNode } from "./nodes/persist.js";
import { planCareerNode } from "./nodes/plan-career.js";
import { showContextNode } from "./nodes/show-context.js";
import { showFinalNode } from "./nodes/show-final.js";
import { showPlanNode } from "./nodes/show-plan.js";
import { validateContextNode } from "./nodes/validate-context.js";
import { responseBuilders } from "./response-builders.js";
import { coldStartStateAnnotation } from "./state.js";
import { coldStartPhaseSchema, NODE } from "./types.js";

import type { ColdStartStateType, UserId } from "./state.js";
import type { ColdStartPhase, ColdStartState } from "./types.js";
import type { ColdStartResponse } from "../../../shared/schemas.js";
import type { GraphDeps } from "../shared/types.js";
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

/* eslint-disable max-lines-per-function, @typescript-eslint/explicit-function-return-type -- LangGraph builder requires fluent chaining */
export function createGraphBuilder() {
  return new StateGraph(coldStartStateAnnotation)
    .addNode(NODE.gather_story, gatherStoryNode)
    .addNode(NODE.parse_story_decision, parseStoryCompletionNode)
    .addNode(NODE.plan_career, planCareerNode)
    .addNode(NODE.show_plan, showPlanNode)
    .addNode(NODE.parse_plan_decision, parseConfirmationNode)
    .addNode(NODE.extract_context, extractContextNode)
    .addNode(NODE.validate_context, validateContextNode)
    .addNode(NODE.clarify, clarifyNode)
    .addNode(NODE.show_context, showContextNode)
    .addNode(NODE.parse_context_decision, parseConfirmationNode)
    .addNode(NODE.edit_context, editContextNode)
    .addNode(NODE.next_context, nextContextNode)
    .addNode(NODE.show_final, showFinalNode)
    .addNode(NODE.parse_final_decision, parseConfirmationNode)
    .addNode(NODE.persist, persistNode)
    .addNode(NODE.cancel, cancelNode)
    .addEdge(START, NODE.gather_story)
    .addEdge(NODE.gather_story, NODE.parse_story_decision)
    .addConditionalEdges(NODE.parse_story_decision, routeAfterStoryDecision, {
      [NODE.plan_career]: NODE.plan_career,
      [NODE.gather_story]: NODE.gather_story,
      [NODE.cancel]: NODE.cancel,
    })
    .addConditionalEdges(NODE.plan_career, routeAfterPlanCareer, {
      [NODE.show_plan]: NODE.show_plan,
      [NODE.cancel]: NODE.cancel,
    })
    .addEdge(NODE.show_plan, NODE.parse_plan_decision)
    .addConditionalEdges(NODE.parse_plan_decision, routeAfterPlanDecision, {
      [NODE.extract_context]: NODE.extract_context,
      [NODE.gather_story]: NODE.gather_story,
      [NODE.cancel]: NODE.cancel,
      [NODE.show_plan]: NODE.show_plan,
    })
    .addEdge(NODE.extract_context, NODE.validate_context)
    .addConditionalEdges(NODE.validate_context, routeAfterValidation, {
      [NODE.clarify]: NODE.clarify,
      [NODE.show_context]: NODE.show_context,
      [NODE.cancel]: NODE.cancel,
    })
    .addEdge(NODE.clarify, NODE.extract_context)
    .addEdge(NODE.show_context, NODE.parse_context_decision)
    .addConditionalEdges(NODE.parse_context_decision, routeAfterContextDecision, {
      [NODE.next_context]: NODE.next_context,
      [NODE.show_final]: NODE.show_final,
      [NODE.edit_context]: NODE.edit_context,
      [NODE.cancel]: NODE.cancel,
      [NODE.show_context]: NODE.show_context,
    })
    .addEdge(NODE.edit_context, NODE.show_context)
    .addEdge(NODE.next_context, NODE.extract_context)
    .addEdge(NODE.show_final, NODE.parse_final_decision)
    .addConditionalEdges(NODE.parse_final_decision, routeAfterFinalDecision, {
      [NODE.persist]: NODE.persist,
      [NODE.show_context]: NODE.show_context,
      [NODE.cancel]: NODE.cancel,
      [NODE.show_final]: NODE.show_final,
    })
    .addEdge(NODE.persist, END)
    .addEdge(NODE.cancel, END);
}
/* eslint-enable max-lines-per-function, @typescript-eslint/explicit-function-return-type */

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
  private readonly compiledGraph: CompiledGraph;

  constructor(private readonly deps: GraphDeps) {
    this.compiledGraph = createGraphBuilder().compile({ checkpointer: deps.checkpointService.getCheckpointer() });
  }

  async run(message: string, threadId: string, userId: UserId, cvText?: string): Promise<ColdStartResponse> {
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
            userResponse: message,
            cvText,
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
