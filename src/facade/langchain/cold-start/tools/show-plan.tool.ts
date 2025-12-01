import { ToolMessage } from "@langchain/core/messages";
import { Command, interrupt } from "@langchain/langgraph";
import { tool } from "langchain";
import { z } from "zod";

import { PHASE } from "../types.js";
import { TOOL_NAME } from "../workflow-constants.js";

import type { ColdStartState } from "../types.js";
import type { ToolRuntime } from "@langchain/core/tools";

export const showPlanTool = tool(
  (_: Record<string, never>, runtime: ToolRuntime<ColdStartState>) => {
    const { toolCallId, state } = runtime;
    const { queue } = state;

    const userMessage = interrupt({
      type: "plan_confirmation",
      message: "Подтвердите план извлечения карьерной истории:",
      queue: queue.map((q) => ({
        preview: q.preview,
        incomingTrails: q.incomingTrails,
      })),
    });

    return new Command({
      update: {
        phase: PHASE.awaiting_plan_confirmation,
        userResponse: String(userMessage),
        /* eslint-disable @typescript-eslint/naming-convention -- LangChain API */
        messages: [
          new ToolMessage({
            content: `Пользователь ответил: "${userMessage}". Проанализируй ответ по правилам INTENT PARSING и вызови ${TOOL_NAME.confirm_plan} (если согласие), ${TOOL_NAME.plan_career_history} (если изменения), или отмени workflow (если отказ).`,
            tool_call_id: toolCallId,
          }),
        ],
        /* eslint-enable @typescript-eslint/naming-convention */
      },
    });
  },
  {
    name: TOOL_NAME.show_plan,
    description:
      `Show career plan to user and wait for response. ` +
      `Call immediately after ${TOOL_NAME.plan_career_history}. ` +
      `After this tool returns, analyze userResponse and decide next action.`,
    schema: z.object({}),
  },
);
