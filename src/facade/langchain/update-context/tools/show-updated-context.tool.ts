import { ToolMessage } from "@langchain/core/messages";
import { Command, interrupt } from "@langchain/langgraph";
import { tool } from "langchain";
import { z } from "zod";

import { phaseGuard } from "../../shared-tools/guards.js";
import { PHASE } from "../types.js";
import { TOOL_NAME } from "../workflow-constants.js";

import type { UserContext } from "../../../../shared/schemas.js";
import type { UpdateContextState } from "../types.js";
import type { ToolRuntime } from "@langchain/core/tools";

function computeDiff(before: UserContext, after: UserContext): Record<string, { before: unknown; after: unknown }> {
  const diff: Record<string, { before: unknown; after: unknown }> = {};
  const beforeRecord: Record<string, unknown> = before;
  const afterRecord: Record<string, unknown> = after;
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const key of keys) {
    const beforeVal = beforeRecord[key];
    const afterVal = afterRecord[key];

    if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
      diff[key] = { before: beforeVal, after: afterVal };
    }
  }

  return diff;
}

export const showUpdatedContextTool = tool(
  (_, runtime: ToolRuntime<UpdateContextState>) => {
    const { state, toolCallId } = runtime;

    const guard = phaseGuard(state.phase, PHASE.awaiting_confirmation, toolCallId);
    if (guard) return guard;

    const { currentContext, updatedContext } = state;
    if (!currentContext || !updatedContext) {
      return new Command({
        update: {
          phase: PHASE.failed,
          /* eslint-disable @typescript-eslint/naming-convention -- LangChain API */
          messages: [
            new ToolMessage({
              content: "Missing context data for comparison.",
              tool_call_id: toolCallId,
            }),
          ],
          /* eslint-enable @typescript-eslint/naming-convention */
        },
      });
    }

    const diff = computeDiff(currentContext, updatedContext);

    const userMessage = interrupt({
      type: "confirmation",
      message: "Review your context changes:",
      before: currentContext,
      after: updatedContext,
      diff,
    });

    return new Command({
      update: {
        /* eslint-disable @typescript-eslint/naming-convention -- LangChain API */
        messages: [
          new ToolMessage({
            content:
              `User responded: "${userMessage}". ` +
              `Analyze intent: APPROVE → ${TOOL_NAME.confirm_update}, EDIT → ${TOOL_NAME.edit_context}, REJECT → cancel.`,
            tool_call_id: toolCallId,
          }),
        ],
        /* eslint-enable @typescript-eslint/naming-convention */
      },
    });
  },
  {
    name: TOOL_NAME.show_updated_context,
    description:
      "Show diff (before → after) and wait for user approval. " +
      "Interrupts to get user response. After resume, analyze intent.",
    schema: z.object({}),
  },
);
