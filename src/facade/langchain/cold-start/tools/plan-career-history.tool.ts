import { HumanMessage, ToolMessage } from "@langchain/core/messages";
import { Command } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { tool } from "langchain";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";

import { config } from "../../../env.js";
import { planningPrompt } from "../prompts.js";
import { contextAgendaBaseSchema, PHASE } from "../types.js";

import type { ColdStartState, ContextAgenda, ContextAgendaBase } from "../types.js";
import type { ToolRuntime } from "@langchain/core/tools";

const planOutputSchema = z.object({
  contexts: z.array(contextAgendaBaseSchema),
});

const planningModel = new ChatOpenAI({
  modelName: "openai/gpt-4o-mini",
  apiKey: process.env.OPENROUTER_API_KEY,
  temperature: config.LANGCHAIN_TEMP_EXTRACTION,
  configuration: {
    baseURL: "https://openrouter.ai/api/v1",
  },
}).withStructuredOutput(planOutputSchema);

function generateContextIds(contexts: ContextAgendaBase[]): ContextAgenda[] {
  return contexts.map((ctx) => ({
    contextId: `ctx_${uuidv7()}`,
    preview: ctx.preview,
    incomingTrails: ctx.incomingTrails,
  }));
}

export const planCareerHistoryTool = tool(
  async (_, runtime: ToolRuntime<ColdStartState>) => {
    const { state, toolCallId } = runtime;
    const { messages } = state;

    const prompt = planningPrompt(messages);
    const planOutput = await planningModel.invoke([new HumanMessage(prompt)]);

    if (!planOutput || planOutput.contexts.length === 0) {
      return new Command({
        update: {
          phase: PHASE.failed,
          /* eslint-disable @typescript-eslint/naming-convention -- LangChain API */
          messages: [
            new ToolMessage({
              content: "Failed to create career plan - no contexts found",
              tool_call_id: toolCallId,
            }),
          ],
          /* eslint-enable @typescript-eslint/naming-convention */
        },
      });
    }

    const queue = generateContextIds(planOutput.contexts);
    const previews = queue.map((q) => q.preview).join("; ");

    return new Command({
      update: {
        phase: PHASE.awaiting_plan_confirmation,
        queue,
        /* eslint-disable @typescript-eslint/naming-convention -- LangChain API */
        messages: [
          new ToolMessage({
            content: `Plan created with ${queue.length} contexts: ${previews}. Now call confirm_plan to get user approval.`,
            tool_call_id: toolCallId,
          }),
        ],
        /* eslint-enable @typescript-eslint/naming-convention */
      },
    });
  },
  {
    name: "plan_career_history",
    description:
      "Analyze career history from messages and build a queue with context IDs. " +
      "AFTER calling this, immediately call confirm_plan to show the plan to the user.",
    schema: z.object({}),
  },
);
