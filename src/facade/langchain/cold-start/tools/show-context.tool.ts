import { ToolMessage } from "@langchain/core/messages";
import { Command, interrupt } from "@langchain/langgraph";
import { tool } from "langchain";
import { z } from "zod";

import { PHASE } from "../types.js";

import type { ColdStartState } from "../types.js";
import type { ToolRuntime } from "@langchain/core/tools";

export const showContextTool = tool(
  (_: Record<string, never>, runtime: ToolRuntime<ColdStartState>) => {
    const { toolCallId, state } = runtime;
    const { collectedContexts, collectedTrails, queue, currentEntityContext } = state;

    const lastContext = collectedContexts.at(-1);
    const relatedTrails = collectedTrails.filter((t) => t.toContextId === lastContext?.contextId);
    const progress = {
      current: (currentEntityContext?.contextIndex ?? 0) + 1,
      total: queue.length,
    };

    const userMessage = interrupt({
      type: "context_confirmation",
      message: `Подтвердите извлечённый контекст (${progress.current}/${progress.total}):`,
      context: lastContext,
      trails: relatedTrails,
      progress,
    });

    return new Command({
      update: {
        phase: PHASE.awaiting_context_confirmation,
        userResponse: String(userMessage),
        /* eslint-disable @typescript-eslint/naming-convention -- LangChain API */
        messages: [
          new ToolMessage({
            content: `Пользователь ответил: "${userMessage}". Проанализируй ответ по правилам INTENT PARSING и вызови confirm_context (если согласие), edit_context/edit_trail (если изменения), или отмени workflow (если отказ).`,
            tool_call_id: toolCallId,
          }),
        ],
        /* eslint-enable @typescript-eslint/naming-convention */
      },
    });
  },
  {
    name: "show_context",
    description:
      "Show extracted context to user and wait for response. " +
      "Call immediately after process_entity_batch succeeds. " +
      "After this tool returns, analyze userResponse and decide next action.",
    schema: z.object({}),
  },
);
