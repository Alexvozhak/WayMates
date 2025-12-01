import { HumanMessage } from "@langchain/core/messages";

import { AgentWorkflow } from "../shared-tools/agent-workflow.js";
import { askClarificationTool } from "../shared-tools/ask-clarification.tool.js";
import { getModel } from "../shared-tools/models.js";

import { SYSTEM_PROMPT } from "./prompts.js";
import { failedResponse, responseBuilders } from "./response-builders.js";
import { confirmUpdateTool, editContextTool, extractUpdatesTool, showUpdatedContextTool } from "./tools/index.js";
import { PHASE, updateContextStateSchema } from "./types.js";

import type { UpdateContextPhase, UpdateContextResponse, UpdateContextState } from "./types.js";
import type { UserContext, UserId } from "../../../shared/schemas.js";

const UPDATE_CONTEXT_TOOLS = [
  extractUpdatesTool,
  showUpdatedContextTool,
  editContextTool,
  confirmUpdateTool,
  askClarificationTool,
];

const TERMINAL_PHASES: readonly UpdateContextPhase[] = [PHASE.saved, PHASE.failed];

export class UpdateContextWorkflow extends AgentWorkflow<
  UpdateContextState,
  UpdateContextResponse,
  UpdateContextPhase
> {
  protected override readonly stateSchema = updateContextStateSchema;
  protected override readonly terminalPhases = TERMINAL_PHASES;
  protected override readonly tools = UPDATE_CONTEXT_TOOLS;
  protected override readonly systemPrompt = SYSTEM_PROMPT;
  protected override readonly responseBuilders = responseBuilders;
  protected override readonly failedResponse = failedResponse;
  protected override readonly model = getModel("agent");

  constructor(
    private readonly userId: UserId,
    private readonly currentContext: UserContext,
  ) {
    super();
  }

  protected override buildInitialInput(message: string): {
    messages: HumanMessage[];
    userId: UserId;
    currentContext: UserContext;
    phase: typeof PHASE.collecting;
  } {
    return {
      messages: [new HumanMessage(message)],
      userId: this.userId,
      currentContext: this.currentContext,
      phase: PHASE.collecting,
    };
  }
}
