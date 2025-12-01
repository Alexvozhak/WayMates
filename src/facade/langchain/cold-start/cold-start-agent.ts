import { HumanMessage } from "@langchain/core/messages";

import { AgentWorkflow } from "../shared-tools/agent-workflow.js";
import { askClarificationTool } from "../shared-tools/ask-clarification.tool.js";
import { getModel } from "../shared-tools/models.js";

import { SYSTEM_PROMPT } from "./prompts.js";
import { failedResponse, responseBuilders } from "./response-builders.js";
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

import type { ColdStartPhase, ColdStartResponse, ColdStartState } from "./types.js";
import type { UserId } from "../../../shared/schemas.js";

const COLD_START_TOOLS = [
  planCareerHistoryTool,
  processEntityBatchTool,
  editContextTool,
  editTrailTool,
  showPlanTool,
  showContextTool,
  showFinalTool,
  askClarificationTool,
  confirmPlanTool,
  confirmContextTool,
  confirmFinalTool,
];

const TERMINAL_PHASES: readonly ColdStartPhase[] = [PHASE.saved, PHASE.already_saved, PHASE.failed];

export class ColdStartWorkflow extends AgentWorkflow<ColdStartState, ColdStartResponse, ColdStartPhase> {
  protected override readonly stateSchema = coldStartStateSchema;
  protected override readonly terminalPhases = TERMINAL_PHASES;
  protected override readonly tools = COLD_START_TOOLS;
  protected override readonly systemPrompt = SYSTEM_PROMPT;
  protected override readonly responseBuilders = responseBuilders;
  protected override readonly failedResponse = failedResponse;
  protected override readonly model = getModel("agent");

  constructor(private readonly userId: UserId) {
    super();
  }

  protected override buildInitialInput(message: string): { messages: HumanMessage[]; userId: UserId } {
    return {
      messages: [new HumanMessage(message)],
      userId: this.userId,
    };
  }
}
