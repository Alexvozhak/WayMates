import { HumanMessage } from "@langchain/core/messages";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { Command, END } from "@langchain/langgraph";
import { tool } from "langchain";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";

import { config } from "../../../env.js";
import { planningPrompt } from "../prompts.js";
import { contextAgendaBaseSchema, PHASE } from "../types.js";

import type { ColdStartState, ContextAgenda, ContextAgendaBase } from "../types.js";

const planOutputSchema = z.object({
  contexts: z.array(contextAgendaBaseSchema),
});

const planningModel = new ChatGoogleGenerativeAI({
  model: config.LANGCHAIN_MODEL_NAME,
  temperature: config.LANGCHAIN_TEMP_EXTRACTION,
}).withStructuredOutput(planOutputSchema);

function generateContextIds(contexts: ContextAgendaBase[]): ContextAgenda[] {
  return contexts.map((ctx) => ({
    contextId: `ctx_${uuidv7()}`,
    preview: ctx.preview,
    incomingTrails: ctx.incomingTrails,
  }));
}

export const planCareerHistoryTool = tool(
  async (_, { state }: { state: ColdStartState }) => {
    const { messages } = state;
    console.log(`🔧 plan_career_history: analyzing ${messages.length} messages`);

    const prompt = planningPrompt(messages);
    const planOutput = await planningModel.invoke([new HumanMessage(prompt)]);

    if (!planOutput || planOutput.contexts.length === 0) {
      return new Command({
        update: { phase: PHASE.failed },
        goto: END,
      });
    }

    const queue = generateContextIds(planOutput.contexts);
    console.log(`📋 Plan created: ${queue.length} contexts`);

    return new Command({
      update: {
        phase: PHASE.awaiting_plan_confirmation,
        queue,
      },
      goto: "confirm_plan",
    });
  },
  {
    name: "plan_career_history",
    description:
      "Analyze career history from messages and build a queue with context IDs. " +
      "Returns Command with queue for user confirmation.",
    schema: z.object({}),
  },
);
