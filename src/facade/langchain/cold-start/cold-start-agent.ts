import { HumanMessage } from "@langchain/core/messages";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { Command } from "@langchain/langgraph";
import { createAgent } from "langchain";

import { config } from "../../env.js";
import { postgresService } from "../../infrastructure/postgres.service.js";
import { askClarificationTool } from "../shared-tools/ask-clarification.tool.js";

import { SYSTEM_PROMPT } from "./prompts.js";
import { buildResponse } from "./response-builders.js";
import { confirmContextTool } from "./tools/confirm-context.tool.js";
import { confirmFinalTool } from "./tools/confirm-final.tool.js";
import { confirmPlanTool } from "./tools/confirm-plan.tool.js";
import { editContextTool } from "./tools/edit-context.tool.js";
import { editTrailTool } from "./tools/edit-trail.tool.js";
import { planCareerHistoryTool } from "./tools/plan-career-history.tool.js";
import { processEntityBatchTool } from "./tools/process-entity-batch.tool.js";
import { showContextTool } from "./tools/show-context.tool.js";
import { showFinalTool } from "./tools/show-final.tool.js";
import { showPlanTool } from "./tools/show-plan.tool.js";
import { coldStartStateSchema, PHASE } from "./types.js";

import type { ColdStartResponse, ColdStartState } from "./types.js";
import type { UserId } from "../../../shared/schemas.js";

// Use Google Gemini 2.0 Flash directly for 1M token context window
const model = new ChatGoogleGenerativeAI({
  model: "gemini-2.0-flash",
  temperature: config.LANGCHAIN_TEMP_AGENT,
});

const COLD_START_TOOLS = [
  // Planning: analyze story → create extraction queue
  planCareerHistoryTool,
  processEntityBatchTool,
  // Editing: user corrections to extracted data
  editContextTool,
  editTrailTool,
  // Show: present data and wait for user response (interrupt)
  showPlanTool,
  showContextTool,
  showFinalTool,
  askClarificationTool,
  // Confirm: finalize after user approval
  confirmPlanTool,
  confirmContextTool,
  confirmFinalTool,
];

export function createColdStartAgent(): ReturnType<typeof createAgent> {
  return createAgent({
    model,
    tools: COLD_START_TOOLS,
    checkpointer: postgresService.getCheckpointer(),
    stateSchema: coldStartStateSchema,
    systemPrompt: SYSTEM_PROMPT,
  });
}

async function getExistingState(threadId: string): Promise<ColdStartState | null> {
  const checkpointState = await postgresService.getCheckpointState(threadId);

  if (!checkpointState || Object.keys(checkpointState).length === 0) {
    return null;
  }

  const parsed = coldStartStateSchema.safeParse(checkpointState);
  if (!parsed.success) {
    return null;
  }

  return parsed.data;
}

function shouldResetState(existingState: ColdStartState | null): boolean {
  if (!existingState) return false;
  const terminalPhases: readonly string[] = [PHASE.saved, PHASE.already_saved, PHASE.failed];
  return terminalPhases.includes(existingState.phase);
}

type AgentInput = { messages: HumanMessage[]; userId: UserId } | Command;

async function resolveInput(
  message: string,
  userId: UserId,
  threadId: string,
  existingState: ColdStartState | null,
): Promise<AgentInput> {
  if (shouldResetState(existingState)) {
    await postgresService.deleteCheckpoint(threadId);
  } else if (await postgresService.hasPendingInterrupt(threadId)) {
    return new Command({ resume: message });
  }

  return { messages: [new HumanMessage(message)], userId };
}

export async function runColdStartWorkflow(
  message: string,
  threadId: string,
  userId: UserId,
): Promise<ColdStartResponse> {
  const agent = createColdStartAgent();
  const existingState = await getExistingState(threadId);
  const input = await resolveInput(message, userId, threadId, existingState);

  const result = await agent.invoke(
    input,
    /* eslint-disable @typescript-eslint/naming-convention -- LangGraph API requires thread_id */
    { configurable: { thread_id: threadId } },
    /* eslint-enable @typescript-eslint/naming-convention */
  );

  return buildResponse(result);
}
