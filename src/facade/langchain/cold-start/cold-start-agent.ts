import { HumanMessage } from "@langchain/core/messages";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { createAgent, humanInTheLoopMiddleware } from "langchain";

import { config } from "../../env.js";
import { postgresService } from "../../infrastructure/postgres.service.js";
import { askClarificationTool } from "../shared-tools/ask-clarification.tool.js";

import { confirmContextTool } from "./tools/confirm-context.tool.js";
import { confirmPlanTool } from "./tools/confirm-plan.tool.js";
import { editEntityTool } from "./tools/edit-entity.tool.js";
import { planCareerHistoryTool } from "./tools/plan-career-history.tool.js";
import { processEntityBatchTool } from "./tools/process-entity-batch.tool.js";
import { coldStartStateSchema } from "./types.js";

import type { ColdStartResponse, ColdStartState } from "./types.js";
import type { UserId } from "../../../shared/schemas.js";

const model = new ChatGoogleGenerativeAI({
  model: config.LANGCHAIN_MODEL_NAME,
  temperature: config.LANGCHAIN_TEMP_AGENT,
});

const SYSTEM_PROMPT = `You are a career history collection assistant for cold start onboarding.

═══════════════════════════════════════════════════
5-PHASE WORKFLOW
═══════════════════════════════════════════════════

PHASE 1: STORY GATHERING (phase="story_gathering")
- Listen to user's career story
- Ask follow-up questions if needed
- When user says "готово"/"done"/"that's all" → call plan_career_history

PHASE 2: PLANNING (phase="planning" → "awaiting_plan_confirmation")
- plan_career_history analyzes messages and builds queue
- Shows timeline for user confirmation
- User confirms → advance to collection

PHASE 3: SEQUENTIAL COLLECTION (phase="sequential_collection")
- For each context in queue:
  - Call process_entity_batch with contextIndex
  - If validation fails → ask_clarification (automatic)
  - If success → confirm_context (automatic)
  - User confirms → advance to next context
- When all contexts done → final preview

PHASE 4: FINAL PREVIEW (phase="awaiting_final_confirmation")
- Show ALL collected data for final confirmation
- User confirms → complete

PHASE 5: COMPLETE (phase="complete")
- Return collected data to MCP handler
- Handler saves to database

═══════════════════════════════════════════════════
CANCEL DETECTION (AT ANY POINT)
═══════════════════════════════════════════════════

If user says "cancel"/"stop"/"quit"/"abort"/"отмена":
1. Respond: "Workflow cancelled. Your data was not saved."
2. DO NOT call any tools
3. Stop workflow

═══════════════════════════════════════════════════
AFTER PLAN CONFIRMATION (phase="awaiting_plan_confirmation")
═══════════════════════════════════════════════════

User response → interpret intent:

1. CONFIRM: "yes", "да", "correct", "looks good"
   → Call process_entity_batch({ contextIndex: 0 })

2. CORRECTION: "add X", "remove Y", "change order"
   → Call plan_career_history again (re-plan with corrections in messages)

3. CANCEL: "cancel", "stop"
   → Cancel workflow

═══════════════════════════════════════════════════
AFTER CLARIFICATION (phase="awaiting_clarification")
═══════════════════════════════════════════════════

User provides answers to questions.
→ Call process_entity_batch with same contextIndex (re-extract with answers)

═══════════════════════════════════════════════════
AFTER CONTEXT CONFIRMATION (phase="awaiting_context_confirmation")
═══════════════════════════════════════════════════

User response → interpret intent:

1. CONFIRM: "yes", "да", "ok"
   → Check progress.current vs progress.total from last response:
     - If current < total: Call process_entity_batch({ contextIndex: current })
     - If current == total (all done): Show final preview

2. MINOR CORRECTION: "add skill X", "change position to Y"
   → Call edit_entity({ entityType, entityId, field, newValue })

3. MAJOR CORRECTION: "that's wrong position", "re-extract"
   → Call process_entity_batch with same contextIndex

4. CANCEL: "cancel", "stop"
   → Cancel workflow

═══════════════════════════════════════════════════
AFTER FINAL CONFIRMATION (phase="awaiting_final_confirmation")
═══════════════════════════════════════════════════

User response → interpret intent:

1. CONFIRM: "yes", "да", "save", "сохранить"
   → Return phase="complete" (MCP handler will save)

2. CORRECTION: "change X"
   → Navigate back to specific context or use edit_entity

3. CANCEL: "cancel", "stop"
   → Cancel workflow

═══════════════════════════════════════════════════
FORMATTING RULES
═══════════════════════════════════════════════════

When showing plan (awaiting_plan_confirmation):
"Your career timeline:
1. [preview] (no transitions before)
2. [preview] ← [trail previews]
3. [preview] ← [trail previews]

Is this correct?"

When showing context (awaiting_context_confirmation):
"Context #[current] of [total]:
• Position: [position]
• Company: [company]
• Period: [dates]
• Skills: [skills]

Related transitions:
• [trail info]

Is this correct?"

When showing final preview (awaiting_final_confirmation):
"Final preview of your career history:

[count] positions:
1. [position] at [company] ([dates])
   Skills: [skills]
   ← [transition info]

Save this?"

═══════════════════════════════════════════════════
IMPORTANT RULES
═══════════════════════════════════════════════════

1. ALWAYS follow tool goto routing (deterministic business logic)
2. Interpret user intent through natural language
3. When in doubt:
   - Clarification context → treat as answers
   - Confirmation context → ask for clarification
4. DO NOT parse/validate data yourself - tools handle that
5. Use progress.current from response to track sequential collection
`;

export function createColdStartAgent(): ReturnType<typeof createAgent> {
  return createAgent({
    model,
    tools: [
      planCareerHistoryTool,
      processEntityBatchTool,
      editEntityTool,
      confirmPlanTool,
      confirmContextTool,
      askClarificationTool,
    ],
    middleware: [
      humanInTheLoopMiddleware({
        /* eslint-disable @typescript-eslint/naming-convention -- LangGraph API requires tool names with underscores */
        interruptOn: {
          confirm_plan: true,
          confirm_context: true,
          ask_clarification: true,
        },
        /* eslint-enable @typescript-eslint/naming-convention */
      }),
    ],
    checkpointer: postgresService.getCheckpointer(),
    stateSchema: coldStartStateSchema,
    systemPrompt: SYSTEM_PROMPT,
  });
}

async function getExistingState(
  agent: ReturnType<typeof createAgent>,
  threadId: string,
): Promise<ColdStartState | null> {
  try {
    /* eslint-disable @typescript-eslint/naming-convention -- LangGraph API requires thread_id */
    const state = await agent.getState({ configurable: { thread_id: threadId } });
    /* eslint-enable @typescript-eslint/naming-convention */
    const parsed = coldStartStateSchema.safeParse(state);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function shouldResetState(existingState: ColdStartState): boolean {
  const terminalPhases = ["complete", "already_completed", "failed"];
  return terminalPhases.includes(existingState.phase);
}

function createInitialState(message: string, userId: UserId): ColdStartState {
  return {
    messages: [new HumanMessage(message)],
    phase: "story_gathering",
    collectedContexts: [],
    collectedTrails: [],
    clarificationRound: 0,
    userId,
  };
}

function continueExistingState(
  existingState: ColdStartState,
  message: string,
  userId: UserId,
): ColdStartState {
  return {
    ...existingState,
    messages: [...existingState.messages, new HumanMessage(message)],
    userId: existingState.userId ?? userId,
  };
}

function buildStoryGatheringResponse(): ColdStartResponse {
  return { phase: "story_gathering", message: "Tell me about your career history." };
}

function buildPlanConfirmationResponse(state: ColdStartState): ColdStartResponse | null {
  if (!state.queue) return null;
  return { phase: "awaiting_plan_confirmation", queue: state.queue };
}

function buildClarificationResponse(state: ColdStartState): ColdStartResponse | null {
  const { missingFields, currentEntityContext, clarificationRound } = state;
  if (!missingFields || !currentEntityContext) return null;
  return {
    phase: "awaiting_clarification",
    missingFields,
    currentEntityContext,
    clarificationRound,
  };
}

function buildContextConfirmationResponse(state: ColdStartState): ColdStartResponse | null {
  const { collectedContexts, collectedTrails, currentEntityContext, queue } = state;
  if (!currentEntityContext) return null;

  const currentContext = collectedContexts.at(-1);
  if (!currentContext) return null;

  return {
    phase: "awaiting_context_confirmation",
    entity: currentContext,
    relatedTrails: collectedTrails.filter((t) => t.toContextId === currentContext.contextId),
    currentEntityContext,
    progress: { current: currentEntityContext.contextIndex + 1, total: queue?.length ?? 0 },
  };
}

function buildFinalConfirmationResponse(state: ColdStartState): ColdStartResponse {
  const { collectedContexts, collectedTrails } = state;
  return {
    phase: "awaiting_final_confirmation",
    preview: { contexts: collectedContexts, trails: collectedTrails },
    summary: { contextsCount: collectedContexts.length, trailsCount: collectedTrails.length },
  };
}

function buildCompleteResponse(state: ColdStartState): ColdStartResponse {
  return {
    phase: "complete",
    collectedContexts: state.collectedContexts,
    collectedTrails: state.collectedTrails,
  };
}

type ResponseBuilder = (state: ColdStartState) => ColdStartResponse | null;

const responseBuilders: Record<string, ResponseBuilder> = {
  /* eslint-disable @typescript-eslint/naming-convention -- Phase names use snake_case */
  story_gathering: () => buildStoryGatheringResponse(),
  awaiting_plan_confirmation: (s) => buildPlanConfirmationResponse(s),
  awaiting_clarification: (s) => buildClarificationResponse(s),
  awaiting_context_confirmation: (s) => buildContextConfirmationResponse(s),
  awaiting_final_confirmation: (s) => buildFinalConfirmationResponse(s),
  complete: (s) => buildCompleteResponse(s),
  already_completed: () => ({
    phase: "already_completed",
    message: "Cold start already completed.",
  }),
  /* eslint-enable @typescript-eslint/naming-convention */
};

function buildResponse(state: ColdStartState): ColdStartResponse {
  const builder = responseBuilders[state.phase];
  return builder?.(state) ?? buildFailedResponse();
}

function buildFailedResponse(): ColdStartResponse {
  return { phase: "failed", message: "Workflow failed. Please try again." };
}

function prepareState(
  existingState: ColdStartState | null,
  message: string,
  userId: UserId,
): ColdStartState {
  if (!existingState || shouldResetState(existingState)) {
    return createInitialState(message, userId);
  }
  return continueExistingState(existingState, message, userId);
}

export async function collectContexts(
  message: string,
  threadId: string,
  userId: UserId,
): Promise<ColdStartResponse> {
  console.log(`ColdStartAgent invoked with threadId: ${threadId}`);

  const agent = createColdStartAgent();
  const existingState = await getExistingState(agent, threadId);
  const initialState = prepareState(existingState, message, userId);

  const result = await agent.invoke(
    initialState,
    /* eslint-disable @typescript-eslint/naming-convention -- LangGraph API requires thread_id */
    { configurable: { thread_id: threadId } },
    /* eslint-enable @typescript-eslint/naming-convention */
  );

  const parsed = coldStartStateSchema.safeParse(result);
  if (!parsed.success) {
    console.error("Failed to parse agent result:", parsed.error);
    return buildFailedResponse();
  }

  console.log(`ColdStartAgent result phase: ${parsed.data.phase}`);
  return buildResponse(parsed.data);
}
