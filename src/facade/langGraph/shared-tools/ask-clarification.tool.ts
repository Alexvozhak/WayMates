import { ToolMessage } from "@langchain/core/messages";
import { Command, interrupt } from "@langchain/langgraph";
import { tool } from "langchain";
import { z } from "zod";

import type { ColdStartState } from "../cold-start-v2/types.js";
import type { ToolRuntime } from "@langchain/core/tools";

/**
 * Ask batch of clarifying questions to the user via interrupt().
 *
 * This tool:
 * 1. Shows missing fields to user
 * 2. Calls interrupt() to pause and wait for user answers
 * 3. Returns userResponse in state for Agent to use in next process_entity_batch call
 */
export const askClarificationTool = tool(
  (_: Record<string, never>, runtime: ToolRuntime<ColdStartState>) => {
    const { toolCallId, state } = runtime;
    const { missingFields, currentEntityContext, clarificationRound } = state;

    console.log(
      `🔧 ask_clarification: asking for ${missingFields.length} missing fields (round ${clarificationRound + 1})`,
    );

    const userMessage = interrupt({
      type: "clarification",
      message: "Уточните следующие поля:",
      missingFields,
      currentEntity: currentEntityContext?.preview,
    });

    console.log("📥 ask_clarification: user responded:", userMessage);

    return new Command({
      update: {
        userResponse: String(userMessage),
        clarificationRound: clarificationRound + 1,

        messages: [
          new ToolMessage({
            content: `Пользователь ответил: "${userMessage}". Используй эти данные для повторного вызова process_entity_batch с тем же contextIndex.`,
            tool_call_id: toolCallId,
          }),
        ],
      },
    });
  },
  {
    name: "ask_clarification",
    description:
      "Ask clarifying questions for missing fields. " +
      "Called when process_entity_batch returns validation errors. " +
      "After user responds, call process_entity_batch again with same contextIndex.",
    schema: z.object({}),
  },
);
