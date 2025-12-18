import { Command, END, START, StateGraph } from "@langchain/langgraph";

import { AgentInvariantError } from "../../errors.js";
import { createInterruptPhaseExtractor } from "../shared/interrupt-utils.js";

import {
  availableNodesByPhase,
  CLARIFY_INTENT_ROUTE_MAP,
  PLAN_CAREER_ROUTE_MAP,
  routeNextNodeAfterClarifyIntent,
  routeNextNodeAfterDecision,
  routeNextNodeAfterPlanCareer,
  routeNextNodeAfterValidation,
  VALIDATION_ROUTE_MAP,
} from "./decision-router.js";
import { cancelNode } from "./nodes/cancel.js";
import { clarifyFieldsNode } from "./nodes/clarify-fields.js";
import { clarifyIntentNode } from "./nodes/clarify-intent.js";
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
import { coldStartPhaseSchema, coldStartStateSchema, NODE, PHASE } from "./types.js";

import type { UserId } from "./state.js";
import type { ColdStartResponse } from "../../../shared/schemas.js";
import type { GraphDeps } from "../shared/types.js";
export { PHASE } from "./state.js";

const extractInterruptPhase = createInterruptPhaseExtractor(coldStartPhaseSchema);

/* eslint-disable @typescript-eslint/explicit-function-return-type -- LangGraph builder requires fluent chaining */
export function createGraphBuilder() {
  // prettier-ignore
  return new StateGraph(coldStartStateAnnotation)
    .addNode(NODE.gather_story, gatherStoryNode)
    .addNode(NODE.parse_story_decision, parseStoryCompletionNode)
    .addNode(NODE.plan_career, planCareerNode)
    .addNode(NODE.show_plan, showPlanNode)
    .addNode(NODE.parse_plan_decision, parseConfirmationNode)
    .addNode(NODE.extract_context, extractContextNode)
    .addNode(NODE.validate_context, validateContextNode)
    .addNode(NODE.clarify_fields, clarifyFieldsNode)
    .addNode(NODE.clarify_intent, clarifyIntentNode)
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
    .addConditionalEdges(NODE.parse_story_decision, routeNextNodeAfterDecision, availableNodesByPhase(PHASE.story_gathering))
    .addConditionalEdges(NODE.plan_career, routeNextNodeAfterPlanCareer, PLAN_CAREER_ROUTE_MAP)
    .addEdge(NODE.show_plan, NODE.parse_plan_decision)
    .addConditionalEdges(NODE.parse_plan_decision, routeNextNodeAfterDecision, availableNodesByPhase(PHASE.awaiting_plan_confirmation))
    .addEdge(NODE.extract_context, NODE.validate_context)
    .addConditionalEdges(NODE.validate_context, routeNextNodeAfterValidation, VALIDATION_ROUTE_MAP)
    .addEdge(NODE.clarify_fields, NODE.extract_context)
    .addEdge(NODE.show_context, NODE.parse_context_decision)
    .addConditionalEdges(NODE.parse_context_decision, routeNextNodeAfterDecision, availableNodesByPhase(PHASE.awaiting_context_confirmation))
    .addEdge(NODE.edit_context, NODE.show_context)
    .addEdge(NODE.next_context, NODE.extract_context)
    .addEdge(NODE.show_final, NODE.parse_final_decision)
    .addConditionalEdges(NODE.parse_final_decision, routeNextNodeAfterDecision, availableNodesByPhase(PHASE.awaiting_final_confirmation))
    .addConditionalEdges(NODE.clarify_intent, routeNextNodeAfterClarifyIntent, CLARIFY_INTENT_ROUTE_MAP)
    .addEdge(NODE.persist, END)
    .addEdge(NODE.cancel, END);
}
/* eslint-enable @typescript-eslint/explicit-function-return-type */

type CompiledGraph = ReturnType<ReturnType<typeof createGraphBuilder>["compile"]>;

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
      const parsed = coldStartStateSchema.safeParse(finalSnapshot.values);
      if (parsed.success) {
        const state = { ...parsed.data, phase: interruptPhase };
        return responseBuilders[state.phase](state);
      }
    }

    const resultParsed = coldStartStateSchema.safeParse(result);
    if (resultParsed.success) {
      return responseBuilders[resultParsed.data.phase](resultParsed.data);
    }

    throw new AgentInvariantError("ColdStartGraph.run", "Invalid state from graph");
  }
}
