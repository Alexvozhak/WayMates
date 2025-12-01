import { ToolMessage } from "@langchain/core/messages";
import { Command, interrupt } from "@langchain/langgraph";
import { tool } from "langchain";
import { z } from "zod";

import { phaseGuard } from "../../shared-tools/guards.js";
import { PHASE } from "../types.js";
import { TOOL_NAME } from "../workflow-constants.js";

import type { UpsertContextState } from "../types.js";
import type { ToolRuntime } from "@langchain/core/tools";

export const showContextTool = tool(
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
              content: "No context to show. Extract context first.",
              tool_call_id: toolCallId,
            }),
          ],
          /* eslint-enable @typescript-eslint/naming-convention */
        },
      });
    }

    const userMessage = interrupt({
      type: "confirmation",
      message: "Review your new career context:",
      context: validatedContext,
    });

    return new Command({
      update: {
        /* eslint-disable @typescript-eslint/naming-convention -- LangChain API */
        messages: [
          new ToolMessage({
            content:
              `User responded: "${userMessage}". ` +
              `Analyze intent: APPROVE → ${TOOL_NAME.confirm_context}, EDIT → ${TOOL_NAME.edit_context}, REJECT → cancel.`,
            tool_call_id: toolCallId,
          }),
        ],
        /* eslint-enable @typescript-eslint/naming-convention */
      },
    });
  },
  {
    name: TOOL_NAME.show_context,
    description:
      "Show extracted context and wait for user approval. " +
      "Interrupts to get user response. After resume, analyze intent.",
    schema: z.object({}),
  },
);
