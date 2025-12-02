import { ToolMessage } from "@langchain/core/messages";
import { Command, interrupt } from "@langchain/langgraph";
import { tool } from "langchain";
import { z } from "zod";

import { AgentInvariantError } from "../../../mcp-server/tools/errors.js";
import { PHASE } from "../types.js";
import { TOOL_NAME } from "../workflow-constants.js";

import type { ColdStartState } from "../types.js";
import type { ToolRuntime } from "@langchain/core/tools";

export const showContextTool = tool(
  (_: Record<string, never>, runtime: ToolRuntime<ColdStartState>) => {
    const { toolCallId, state } = runtime;
    const { collectedContexts, collectedTrails, queue, currentEntityContext } = state;

    const lastContext = collectedContexts.at(-1);
    if (!lastContext) {
      throw new AgentInvariantError(TOOL_NAME.show_context, "collectedContexts is empty", {
        collectedContextsLength: collectedContexts.length,
        phase: state.phase,
      });
    }
    const relatedTrails = collectedTrails.filter((t) => t.toContextId === lastContext.contextId);
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
            content:
              `[CONTEXT ${progress.current}/${progress.total} CONFIRMATION] ` +
              `contextId: ${lastContext.contextId} ` +
              `Пользователь ответил: "${userMessage}". ` +
              `⚠️ Это ответ НА КОНТЕКСТ #${progress.current}, НЕ на финальное сохранение всей истории! ` +
              `Проанализируй ответ по правилам INTENT PARSING: ` +
              `${TOOL_NAME.confirm_context} (согласие), ` +
              `${TOOL_NAME.edit_context}(contextId="${lastContext.contextId}", corrections) / ${TOOL_NAME.edit_trail} (изменения), ` +
              `или cancel_workflow (отказ).`,
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
      `Show extracted context to user and wait for response. ` +
      `Call immediately after ${TOOL_NAME.process_entity_batch} succeeds. ` +
      `After this tool returns, analyze userResponse and decide next action.`,
    schema: z.object({}),
  },
);
