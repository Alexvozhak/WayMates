import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { Command, END } from "@langchain/langgraph";
import { tool } from "langchain";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";

import { config } from "../../../env.js";
import { contextAgendaSchema } from "../types.js";

import type { ColdStartState, ContextAgenda } from "../types.js";
import type { BaseMessage } from "@langchain/core/messages";

const planOutputSchema = z.object({
  contexts: z.array(
    z.object({
      preview: z.string().describe("Short preview: 'Junior Backend в Яндексе 2020-2022'"),
      incomingTrails: z
        .array(z.string())
        .describe("Trail previews leading TO this context: ['Coursera React 2022']"),
    }),
  ),
});

type PlanOutput = z.infer<typeof planOutputSchema>;

const planningModel = new ChatGoogleGenerativeAI({
  model: config.LANGCHAIN_MODEL_NAME,
  temperature: config.LANGCHAIN_TEMP_EXTRACTION,
}).withStructuredOutput(planOutputSchema);

function buildPlanningPrompt(messages: BaseMessage[]): string {
  const messagesText = messages.map((m) => `${m.getType()}: ${m.content}`).join("\n");

  return `Analyze the career history from the conversation and identify ALL career positions (contexts) in CHRONOLOGICAL order (oldest first).

For each position, identify:
1. A short preview string: "Position at Company YYYY-YYYY, key skills"
2. Incoming trails: learning activities/transitions that LED TO this position (from the previous one)

RULES:
- Order positions chronologically (oldest first)
- First position has NO incoming trails
- Trails describe HOW the person transitioned (courses, certifications, promotions)
- Each trail preview should be short: "Coursera React course 2022"

CONVERSATION:
${messagesText}

Return the structured list of career contexts with their incoming trails.`;
}

function generateContextIds(planOutput: PlanOutput): ContextAgenda[] {
  return planOutput.contexts.map((ctx) => ({
    contextId: `ctx_${uuidv7()}`,
    preview: ctx.preview,
    incomingTrails: ctx.incomingTrails,
  }));
}

function validateQueue(queue: ContextAgenda[]): void {
  for (const item of queue) {
    contextAgendaSchema.parse(item);
  }
}

export const planCareerHistoryTool = tool(
  async (_params: Record<string, never>, toolConfig: { state: ColdStartState }) => {
    const { messages } = toolConfig.state;
    console.log(`🔧 plan_career_history: analyzing ${messages.length} messages`);

    const prompt = buildPlanningPrompt(messages);
    const planOutput = await planningModel.invoke([{ role: "user", content: prompt }]);

    if (!planOutput || planOutput.contexts.length === 0) {
      return new Command({
        update: { phase: "failed" as const },
        goto: END,
      });
    }

    const queue = generateContextIds(planOutput);
    validateQueue(queue);

    console.log(`📋 Plan created: ${queue.length} contexts`);

    return new Command({
      update: {
        phase: "awaiting_plan_confirmation" as const,
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
