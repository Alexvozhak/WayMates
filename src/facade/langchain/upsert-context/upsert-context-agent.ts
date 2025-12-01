import { HumanMessage } from "@langchain/core/messages";

import { AgentWorkflow } from "../shared-tools/agent-workflow.js";
import { getModel } from "../shared-tools/models.js";

import { SYSTEM_PROMPT } from "./prompts.js";
import { failedResponse, responseBuilders } from "./response-builders.js";
import { confirmContextTool } from "./tools/confirm-context.tool.js";
import { editContextTool } from "./tools/edit-context.tool.js";
import { extractContextTool } from "./tools/extract-context.tool.js";
import { showContextTool } from "./tools/show-context.tool.js";
import { PHASE, upsertContextStateSchema } from "./types.js";

import type { UpsertContextPhase, UpsertContextResponse, UpsertContextState } from "./types.js";
import type { UserId } from "../../../shared/schemas.js";

const UPSERT_CONTEXT_TOOLS = [extractContextTool, showContextTool, confirmContextTool, editContextTool];

const TERMINAL_PHASES: readonly UpsertContextPhase[] = [PHASE.saved, PHASE.failed];

export class UpsertContextWorkflow extends AgentWorkflow<
  UpsertContextState,
  UpsertContextResponse,
  UpsertContextPhase
> {
  protected override readonly stateSchema = upsertContextStateSchema;
  protected override readonly terminalPhases = TERMINAL_PHASES;
  protected override readonly tools = UPSERT_CONTEXT_TOOLS;
  protected override readonly systemPrompt = SYSTEM_PROMPT;
  protected override readonly responseBuilders = responseBuilders;
  protected override readonly failedResponse = failedResponse;
  protected override readonly model = getModel("agent");

  constructor(private readonly userId: UserId) {
    super();
  }

  protected override buildInitialInput(message: string): {
    messages: HumanMessage[];
    userId: UserId;
    phase: typeof PHASE.extracting;
  } {
    return {
      messages: [new HumanMessage(message)],
      userId: this.userId,
      phase: PHASE.extracting,
    };
  }
}
