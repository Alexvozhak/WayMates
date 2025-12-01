import { ToolMessage } from "@langchain/core/messages";
import { Command } from "@langchain/langgraph";
import { tool } from "langchain";
import { z } from "zod";

import { phaseGuard } from "../../shared-tools/guards.js";
import { PHASE } from "../types.js";
import { TOOL_NAME } from "../workflow-constants.js";

import type { ColdStartState } from "../types.js";
import type { ToolRuntime } from "@langchain/core/tools";

export const confirmFinalTool = tool(
  (_, runtime: ToolRuntime<ColdStartState>) => {
    const { toolCallId, state } = runtime;

    const guard = phaseGuard(state.phase, PHASE.awaiting_final_confirmation, toolCallId);
    if (guard) return guard;

    if (!state.userResponse) {
      return new Command({
        update: {
          /* eslint-disable @typescript-eslint/naming-convention -- LangChain API */
          messages: [
            new ToolMessage({
              content: `Cannot confirm: you must call ${TOOL_NAME.show_final} first to show the final preview to user and get their approval.`,
              tool_call_id: toolCallId,
            }),
          ],
          /* eslint-enable @typescript-eslint/naming-convention */
        },
      });
    }

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

    return new Command({
      update: {
        phase: PHASE.saved,
        /* eslint-disable @typescript-eslint/naming-convention -- LangChain API */
        messages: [
          new ToolMessage({
            content: "Career history saved successfully!",
            tool_call_id: toolCallId,
          }),
        ],
        /* eslint-enable @typescript-eslint/naming-convention */
      },
    });
  },
  {
    name: TOOL_NAME.confirm_final,
    description:
      `Confirm save. Call when user APPROVED final preview (да, ok, yes, save, сохранить). ` +
      `You must analyze userResponse from ${TOOL_NAME.show_final} first.`,
    schema: z.object({}),
  },
);
