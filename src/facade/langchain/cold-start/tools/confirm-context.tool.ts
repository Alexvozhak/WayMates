import { ToolMessage } from "@langchain/core/messages";
import { Command } from "@langchain/langgraph";
import { tool } from "langchain";
import { z } from "zod";

import { phaseGuard } from "../../shared-tools/guards.js";
import { PHASE } from "../types.js";
import { TOOL_NAME } from "../workflow-constants.js";

import type { ColdStartState } from "../types.js";
import type { ToolRuntime } from "@langchain/core/tools";

export const confirmContextTool = tool(
  (_, runtime: ToolRuntime<ColdStartState>) => {
    const { toolCallId, state } = runtime;

    const guard = phaseGuard(state.phase, PHASE.awaiting_context_confirmation, toolCallId);
    if (guard) return guard;

    const { queue } = state;
    const processed = state.collectedContexts.length;

    if (processed < queue.length) {
      return new Command({
        update: {
          /* eslint-disable @typescript-eslint/naming-convention -- LangChain API */
          messages: [
            new ToolMessage({
              content: `Context confirmed. Now call ${TOOL_NAME.process_entity_batch} with contextIndex: ${processed} to continue extraction.`,
              tool_call_id: toolCallId,
            }),
          ],
          /* eslint-enable @typescript-eslint/naming-convention */
        },
      });
    }

    return new Command({
      update: {
        phase: PHASE.awaiting_final_confirmation,
        userResponse: undefined,
        /* eslint-disable @typescript-eslint/naming-convention -- LangChain API */
        messages: [
          new ToolMessage({
            content: `All contexts extracted. Now call ${TOOL_NAME.show_final} to show complete career history for final approval.`,
            tool_call_id: toolCallId,
          }),
        ],
        /* eslint-enable @typescript-eslint/naming-convention */
      },
    });
  },
  {
    name: TOOL_NAME.confirm_context,
    description:
      `Confirm context. Call when user APPROVED (да, ok, yes, подтверждаю, норм). ` +
      `You must analyze userResponse from ${TOOL_NAME.show_context} first.`,
    schema: z.object({}),
  },
);
