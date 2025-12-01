import { ToolMessage } from "@langchain/core/messages";
import { Command, interrupt } from "@langchain/langgraph";
import { tool } from "langchain";
import { z } from "zod";

import { PHASE } from "../types.js";
import { TOOL_NAME } from "../workflow-constants.js";

import type { ColdStartState } from "../types.js";
import type { ToolRuntime } from "@langchain/core/tools";

export const showFinalTool = tool(
  (_: Record<string, never>, runtime: ToolRuntime<ColdStartState>) => {
    const { toolCallId, state } = runtime;
    const { collectedContexts, collectedTrails } = state;

    const userMessage = interrupt({
      type: "final_confirmation",
      message: "Финальный просмотр вашей карьерной истории. Сохранить?",
      preview: {
        contexts: collectedContexts,
        trails: collectedTrails,
      },
      summary: {
        contextsCount: collectedContexts.length,
        trailsCount: collectedTrails.length,
      },
    });

    return new Command({
      update: {
        phase: PHASE.awaiting_final_confirmation,
        userResponse: String(userMessage),
        /* eslint-disable @typescript-eslint/naming-convention -- LangChain API */
        messages: [
          new ToolMessage({
            content: `Пользователь ответил: "${userMessage}". Проанализируй ответ по правилам INTENT PARSING и вызови ${TOOL_NAME.confirm_final} (если согласие сохранить), ${TOOL_NAME.edit_context}/${TOOL_NAME.edit_trail} (если изменения), или отмени workflow (если отказ).`,
            tool_call_id: toolCallId,
          }),
        ],
        /* eslint-enable @typescript-eslint/naming-convention */
      },
    });
  },
  {
    name: TOOL_NAME.show_final,
    description:
      `Show complete career history for final confirmation before save. ` +
      `Call when all contexts are processed. ` +
      `After this tool returns, analyze userResponse and decide: ${TOOL_NAME.confirm_final} or edit/cancel.`,
    schema: z.object({}),
  },
);
