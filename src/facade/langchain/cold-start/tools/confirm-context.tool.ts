import { ToolMessage } from "@langchain/core/messages";
import { Command } from "@langchain/langgraph";
import { tool } from "langchain";
import { z } from "zod";

import { PHASE } from "../types.js";

import type { ColdStartState } from "../types.js";
import type { ToolRuntime } from "@langchain/core/tools";

export const confirmContextTool = tool(
  (_, runtime: ToolRuntime<ColdStartState>) => {
    const { toolCallId, state } = runtime;
    const { queue } = state;
    const processed = state.collectedContexts.length;

    if (processed < queue.length) {
      // More contexts to process
      return new Command({
        update: {
          /* eslint-disable @typescript-eslint/naming-convention -- LangChain API */
          messages: [
            new ToolMessage({
              content: `Context confirmed. Now call process_entity_batch with contextIndex: ${processed} to continue extraction.`,
              tool_call_id: toolCallId,
            }),
          ],
          /* eslint-enable @typescript-eslint/naming-convention */
        },
      });
    }

    // All contexts processed → set phase for final confirmation
    // IMPORTANT: Set phase HERE so that when show_final calls interrupt(),
    // the checkpoint has correct phase. Otherwise interrupt would save
    // awaiting_context_confirmation and test loop won't detect transition.
    return new Command({
      update: {
        phase: PHASE.awaiting_final_confirmation,
        /* eslint-disable @typescript-eslint/naming-convention -- LangChain API */
        messages: [
          new ToolMessage({
            content:
              "All contexts extracted. Now call show_final to show complete career history for final approval.",
            tool_call_id: toolCallId,
          }),
        ],
        /* eslint-enable @typescript-eslint/naming-convention */
      },
    });
  },
  {
    name: "confirm_context",
    description:
      "Confirm context. Call when user APPROVED (да, ok, yes, подтверждаю, норм). " +
      "You must analyze userResponse from show_context first.",
    schema: z.object({}),
  },
);
