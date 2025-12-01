import { ToolMessage } from "@langchain/core/messages";
import { Command } from "@langchain/langgraph";
import { tool } from "langchain";
import { z } from "zod";

import { phaseGuard } from "../../shared-tools/guards.js";
import { PHASE } from "../types.js";
import { TOOL_NAME } from "../workflow-constants.js";

import type { UpsertContextState } from "../types.js";
import type { ToolRuntime } from "@langchain/core/tools";

export const confirmContextTool = tool(
  (_, runtime: ToolRuntime<UpsertContextState>) => {
    const { state, toolCallId } = runtime;

    const guard = phaseGuard(state.phase, PHASE.awaiting_confirmation, toolCallId);
    if (guard) return guard;

    const { validatedContext } = state;
    if (!validatedContext) {
      return new Command({
        update: {
          phase: PHASE.failed,
          /* eslint-disable @typescript-eslint/naming-convention -- LangChain API */
          messages: [
            new ToolMessage({
              content: "No context to save.",
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
            content: "Context confirmed and saved.",
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
      "Confirm and save context. Call when user APPROVED (да, ok, yes, save). " +
      `Analyze userResponse from ${TOOL_NAME.show_context} first.`,
    schema: z.object({}),
  },
);
