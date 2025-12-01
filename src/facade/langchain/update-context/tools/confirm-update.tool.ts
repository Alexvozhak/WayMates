import { ToolMessage } from "@langchain/core/messages";
import { Command } from "@langchain/langgraph";
import { tool } from "langchain";
import { z } from "zod";

import { phaseGuard } from "../../shared-tools/guards.js";
import { PHASE } from "../types.js";
import { TOOL_NAME } from "../workflow-constants.js";

import type { UpdateContextState } from "../types.js";
import type { ToolRuntime } from "@langchain/core/tools";

export const confirmUpdateTool = tool(
  (_, runtime: ToolRuntime<UpdateContextState>) => {
    const { state, toolCallId } = runtime;

    const guard = phaseGuard(state.phase, PHASE.awaiting_confirmation, toolCallId);
    if (guard) return guard;

    const { updatedContext } = state;
    if (!updatedContext) {
      return new Command({
        update: {
          phase: PHASE.failed,
          /* eslint-disable @typescript-eslint/naming-convention -- LangChain API */
          messages: [
            new ToolMessage({
              content: "No updated context to save.",
              tool_call_id: toolCallId,
            }),
          ],
          /* eslint-enable @typescript-eslint/naming-convention */
        },
      });
    }

    return new Command({
      update: {
        phase: PHASE.saved,
        /* eslint-disable @typescript-eslint/naming-convention -- LangChain API */
        messages: [
          new ToolMessage({
            content: "Context update confirmed and saved.",
            tool_call_id: toolCallId,
          }),
        ],
        /* eslint-enable @typescript-eslint/naming-convention */
      },
    });
  },
  {
    name: TOOL_NAME.confirm_update,
    description:
      "Confirm context update. Call when user APPROVED (да, ok, yes, save). " +
      `Analyze userResponse from ${TOOL_NAME.show_updated_context} first.`,
    schema: z.object({}),
  },
);
