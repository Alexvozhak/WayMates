import { HumanMessage, ToolMessage } from "@langchain/core/messages";
import { Command } from "@langchain/langgraph";
import { tool } from "langchain";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";

import { getModel } from "../../shared-tools/models.js";
import { planningPrompt } from "../prompts.js";
import { contextAgendaBaseSchema, PHASE } from "../types.js";
import { TOOL_NAME } from "../workflow-constants.js";

import type { ColdStartState, ContextAgenda, ContextAgendaBase } from "../types.js";
import type { ToolRuntime } from "@langchain/core/tools";

const planOutputSchema = z.object({
  contexts: z.array(contextAgendaBaseSchema),
});

const planningModel = getModel("planning").withStructuredOutput(planOutputSchema);

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
            content: `Plan created with ${queue.length} contexts: ${previews}. Now call ${TOOL_NAME.show_plan} to present to user and wait for approval.`,
            tool_call_id: toolCallId,
          }),
        ],
        /* eslint-enable @typescript-eslint/naming-convention */
      },
    });
  },
  {
    name: TOOL_NAME.plan_career_history,
    description:
      `Analyze career history from messages and build a queue with context IDs. ` +
      `AFTER calling this, immediately call ${TOOL_NAME.show_plan} to present the plan to user.`,
    schema: z.object({}),
  },
);
