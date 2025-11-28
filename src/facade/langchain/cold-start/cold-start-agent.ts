import { HumanMessage } from "@langchain/core/messages";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { createAgent, humanInTheLoopMiddleware } from "langchain";
import { z } from "zod";

import { config } from "../../env.js";
import { postgresService } from "../../infrastructure/postgres.service.js";
import { InvalidStateError } from "../../mcp-server/tools/errors.js";
import { askClarificationTool } from "../shared-tools/ask-clarification.tool.js";

import { SYSTEM_PROMPT } from "./prompts.js";
import { confirmContextTool } from "./tools/confirm-context.tool.js";
import { confirmFinalTool } from "./tools/confirm-final.tool.js";
import { confirmPlanTool } from "./tools/confirm-plan.tool.js";
import { editContextTool } from "./tools/edit-context.tool.js";
import { editTrailTool } from "./tools/edit-trail.tool.js";
import { planCareerHistoryTool } from "./tools/plan-career-history.tool.js";
import { processEntityBatchTool } from "./tools/process-entity-batch.tool.js";
import { coldStartStateSchema, PHASE } from "./types.js";

import type { ColdStartResponse, ColdStartState } from "./types.js";
import type { UserId } from "../../../shared/schemas.js";

const model = new ChatGoogleGenerativeAI({
  model: config.LANGCHAIN_MODEL_NAME,
  temperature: config.LANGCHAIN_TEMP_AGENT,
});

export function createColdStartAgent(): ReturnType<typeof createAgent> {
  return createAgent({
    model,
    tools: [
      planCareerHistoryTool,
      processEntityBatchTool,
      editContextTool,
      editTrailTool,
      confirmPlanTool,
      confirmContextTool,
      confirmFinalTool,
      askClarificationTool,
    ],
    middleware: [
      humanInTheLoopMiddleware({
        /* eslint-disable @typescript-eslint/naming-convention -- LangGraph API requires tool names with underscores */
        interruptOn: {
          confirm_plan: true,
          confirm_context: true,
          confirm_final: true,
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

const stateSnapshotSchema = z.object({
  values: z.record(z.unknown()).optional(),
});

function getExistingState(
  agent: ReturnType<typeof createAgent>,
  threadId: string,
): ColdStartState | null {
  /* eslint-disable @typescript-eslint/naming-convention -- LangGraph API requires thread_id */
  const rawSnapshot = agent.getState({
    configurable: { thread_id: threadId },
  });
  /* eslint-enable @typescript-eslint/naming-convention */

  const snapshotParsed = stateSnapshotSchema.safeParse(rawSnapshot);
  if (!snapshotParsed.success || !snapshotParsed.data.values) {
    return null;
  }

  const values = snapshotParsed.data.values;
  if (Object.keys(values).length === 0) {
    return null;
  }

  const parsed = coldStartStateSchema.safeParse(values);
  if (!parsed.success) {
    const errorDetails = JSON.stringify(parsed.error.flatten());
    throw new Error(`Invalid cold start state schema: ${errorDetails}`);
  }

  return parsed.data;
}

function shouldResetState(existingState: ColdStartState): boolean {
  const terminalPhases: readonly string[] = [PHASE.saved, PHASE.already_saved, PHASE.failed];
  return terminalPhases.includes(existingState.phase);
}

function createInitialState(message: string, userId: UserId): ColdStartState {
  return coldStartStateSchema.parse({
    messages: [new HumanMessage(message)],
    userId,
  });
}

function continueExistingState(existingState: ColdStartState, message: string): ColdStartState {
  return {
    ...existingState,
    messages: [...existingState.messages, new HumanMessage(message)],
  };
}

function buildStoryGatheringResponse(): ColdStartResponse {
  return { phase: "story_gathering", message: "Tell me about your career history." };
}

function buildPlanConfirmationResponse(state: ColdStartState): ColdStartResponse {
  if (state.queue.length === 0) {
    throw new InvalidStateError("awaiting_plan_confirmation", "queue is empty");
  }
  return { phase: "awaiting_plan_confirmation", queue: state.queue };
}

function buildClarificationResponse(state: ColdStartState): ColdStartResponse {
  const { missingFields } = state;
  if (missingFields.length === 0) {
    throw new InvalidStateError("awaiting_clarification", "missingFields is empty");
  }
  return {
    phase: "awaiting_clarification",
    missingFields,
  };
}

function buildContextConfirmationResponse(state: ColdStartState): ColdStartResponse {
  const { collectedContexts, collectedTrails, currentEntityContext, queue } = state;
  if (!currentEntityContext) {
    throw new InvalidStateError("awaiting_context_confirmation", "currentEntityContext is missing");
  }

  const currentContext = collectedContexts.at(-1);
  if (!currentContext) {
    throw new InvalidStateError("awaiting_context_confirmation", "no collected contexts");
  }

  return {
    phase: "awaiting_context_confirmation",
    entity: currentContext,
    relatedTrails: collectedTrails.filter((t) => t.toContextId === currentContext.contextId),
    progress: { current: currentEntityContext.contextIndex + 1, total: queue.length },
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

function buildSavedResponse(state: ColdStartState): ColdStartResponse {
  return {
    phase: "saved",
    userId: state.userId,
    contexts: state.collectedContexts,
    trails: state.collectedTrails,
  };
}

type ResponseBuilder = (state: ColdStartState) => ColdStartResponse;

const responseBuilders: Record<string, ResponseBuilder> = {
  /* eslint-disable @typescript-eslint/naming-convention -- Phase names use snake_case */
  story_gathering: () => buildStoryGatheringResponse(),
  awaiting_plan_confirmation: (s) => buildPlanConfirmationResponse(s),
  awaiting_clarification: (s) => buildClarificationResponse(s),
  awaiting_context_confirmation: (s) => buildContextConfirmationResponse(s),
  awaiting_final_confirmation: (s) => buildFinalConfirmationResponse(s),
  saved: (s) => buildSavedResponse(s),
  already_saved: () => ({
    phase: "already_saved",
    message: "Cold start already saved.",
  }),
  failed: () => buildFailedResponse(),
  /* eslint-enable @typescript-eslint/naming-convention */
};

function buildResponse(state: ColdStartState): ColdStartResponse {
  const builder = responseBuilders[state.phase];
  if (!builder) {
    throw new InvalidStateError(state.phase, "unknown phase");
  }
  return builder(state);
}

function buildFailedResponse(): ColdStartResponse {
  return { phase: "failed", message: "Workflow failed. Please try again." };
}

export async function runColdStartWorkflow(
  message: string,
  threadId: string,
  userId: UserId,
): Promise<ColdStartResponse> {
  console.log(`ColdStartAgent invoked with threadId: ${threadId}`);

  const agent = createColdStartAgent();
  const existingState = getExistingState(agent, threadId);

  const shouldStartFresh = !existingState || shouldResetState(existingState);
  const initialState = shouldStartFresh
    ? createInitialState(message, userId)
    : continueExistingState(existingState, message);

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
