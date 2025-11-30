import { ToolMessage } from "@langchain/core/messages";
import { Command } from "@langchain/langgraph";

import { AgentInvariantError } from "../../../mcp-server/tools/errors.js";
import { getRequiredToolNames, TOOL_NAME } from "../workflow-constants.js";

import type { ColdStartPhase, ColdStartState } from "../types.js";

export function phaseGuard(
  currentPhase: ColdStartPhase,
  expectedPhase: ColdStartPhase | ColdStartPhase[],
  toolCallId: string,
): Command | null {
  const allowed = Array.isArray(expectedPhase) ? expectedPhase : [expectedPhase];

  if (allowed.includes(currentPhase)) {
    return null;
  }

  const expectedStr = allowed.join(" | ");
  const requiredTools = getRequiredToolNames(allowed);

  console.warn(
    `[phaseGuard] LLM called tool in wrong phase. ` +
      `Current: "${currentPhase}", expected: "${expectedStr}". ` +
      `Required tool: ${requiredTools ?? "none"}`,
  );

  const message = requiredTools
    ? `Cannot proceed. Current phase: "${currentPhase}", expected: "${expectedStr}". You MUST call ${requiredTools} first.`
    : `Cannot proceed. Current phase: "${currentPhase}", expected: "${expectedStr}".`;

  return new Command({
    update: {
      /* eslint-disable @typescript-eslint/naming-convention -- LangChain API */
      messages: [new ToolMessage({ content: message, tool_call_id: toolCallId })],
      /* eslint-enable @typescript-eslint/naming-convention */
    },
  });
}

export function assertStateValid(state: ColdStartState, toolName: string): void {
  if (!state.userId) {
    throw new AgentInvariantError(toolName, "userId missing in state");
  }
  if (!state.queue) {
    throw new AgentInvariantError(toolName, "queue undefined in state");
  }
}

export function dataGuardForSave(state: ColdStartState, toolCallId: string): Command | null {
  const { collectedContexts, queue } = state;

  if (!collectedContexts || collectedContexts.length === 0) {
    return new Command({
      update: {
        /* eslint-disable @typescript-eslint/naming-convention -- LangChain API */
        messages: [
          new ToolMessage({
            content: "Cannot save: no contexts collected. Collection may have failed.",
            tool_call_id: toolCallId,
          }),
        ],
        /* eslint-enable @typescript-eslint/naming-convention */
      },
    });
  }

  if (collectedContexts.length !== queue.length) {
    return new Command({
      update: {
        /* eslint-disable @typescript-eslint/naming-convention -- LangChain API */
        messages: [
          new ToolMessage({
            content:
              `Cannot save: only ${collectedContexts.length}/${queue.length} contexts processed. ` +
              `Continue with ${TOOL_NAME.process_entity_batch}.`,
            tool_call_id: toolCallId,
          }),
        ],
        /* eslint-enable @typescript-eslint/naming-convention */
      },
    });
  }

  return null;
}
