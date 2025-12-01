import { ToolMessage } from "@langchain/core/messages";
import { Command } from "@langchain/langgraph";
import { tool } from "langchain";
import { z } from "zod";

import { PHASE } from "../types.js";
import { TOOL_NAME } from "../workflow-constants.js";

import type { ColdStartState } from "../types.js";
import type { ToolRuntime } from "@langchain/core/tools";

export const cancelWorkflowTool = tool(
  (input: { reason?: string }, runtime: ToolRuntime<ColdStartState>) => {
    const { toolCallId } = runtime;
    const reason = input.reason ?? "User requested cancellation";

    return new Command({
      update: {
        phase: PHASE.failed,
        /* eslint-disable @typescript-eslint/naming-convention -- LangGraph API */
        messages: [
          new ToolMessage({
            content: `Workflow cancelled: ${reason}. Your data was not saved.`,
            tool_call_id: toolCallId,
          }),
        ],
        /* eslint-enable @typescript-eslint/naming-convention */
      },
    });
  },
  {
    name: TOOL_NAME.cancel_workflow,
    description:
      `Cancel workflow without saving. Call when user says cancel/stop/quit/abort/отмена/нет. ` +
      `Sets phase to failed and stops workflow.`,
    schema: z.object({
      reason: z.string().optional().describe("Optional reason for cancellation"),
    }),
  },
);
