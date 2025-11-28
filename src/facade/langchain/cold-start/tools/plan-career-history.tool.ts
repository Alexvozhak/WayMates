import { HumanMessage } from "@langchain/core/messages";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { Command, END } from "@langchain/langgraph";
import { tool } from "langchain";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";

import { config } from "../../../env.js";
import { coldStartPhaseSchema, contextAgendaBaseSchema } from "../types.js";

import type { ColdStartState, ContextAgenda, ContextAgendaBase } from "../types.js";
import type { BaseMessage } from "@langchain/core/messages";

const planOutputSchema = z.object({
  contexts: z.array(contextAgendaBaseSchema),
});

type PlanOutput = { contexts: ContextAgendaBase[] };

const planningModel = new ChatGoogleGenerativeAI({
  model: config.LANGCHAIN_MODEL_NAME,
  temperature: config.LANGCHAIN_TEMP_EXTRACTION,
}).withStructuredOutput(planOutputSchema);

function buildPlanningPrompt(messages: BaseMessage[]): string {
  const messagesText = messages.map((m) => `${m.type}: ${m.content}`).join("\n");

  return `Analyze career history and create a collection plan.

CONVERSATION:
${messagesText}

═══════════════════════════════════════════════════
YOUR TASK: Identify all career positions in CHRONOLOGICAL order (oldest → newest)
═══════════════════════════════════════════════════

For each position, return:
1. preview: Short label - "Role at Company YYYY-YYYY" (e.g., "Junior Developer at Yandex 2018-2020")
2. incomingTrails: Learning activities that LED TO this position (from the previous one)

═══════════════════════════════════════════════════
RULES:
═══════════════════════════════════════════════════
- First position has EMPTY incomingTrails array (no prior context to transition from)
- Trails describe HOW the person transitioned: courses, certifications, bootcamps, self-study
- Trail preview format: "Platform Course Name YYYY" (e.g., "Coursera Machine Learning 2019")
- Include promotions and internal moves as separate positions if significantly different
- Education → first job counts as first position (no incoming trail needed)

═══════════════════════════════════════════════════
EXAMPLE OUTPUT:
═══════════════════════════════════════════════════
contexts: [
  { preview: "Intern at Startup 2017-2018", incomingTrails: [] },
  { preview: "Junior Python Dev at Yandex 2018-2020", incomingTrails: ["CS50 Harvard course 2017"] },
  { preview: "Senior Backend at Google 2020-2023", incomingTrails: ["System Design course 2020", "Go Lang bootcamp 2020"] }
]`;
}

function generateContextIds(planOutput: PlanOutput): ContextAgenda[] {
  return planOutput.contexts.map((ctx) => ({
    contextId: `ctx_${uuidv7()}`,
    preview: ctx.preview,
    incomingTrails: ctx.incomingTrails,
  }));
}

export const planCareerHistoryTool = tool(
  async (_, toolConfig: { state: ColdStartState }) => {
    const { messages } = toolConfig.state;
    console.log(`🔧 plan_career_history: analyzing ${messages.length} messages`);

    const prompt = buildPlanningPrompt(messages);
    const planOutput = await planningModel.invoke([new HumanMessage(prompt)]);

    if (!planOutput || planOutput.contexts.length === 0) {
      return new Command({
        update: { phase: coldStartPhaseSchema.Values.failed },
        goto: END,
      });
    }

    const queue = generateContextIds(planOutput);
    console.log(`📋 Plan created: ${queue.length} contexts`);

    return new Command({
      update: {
        phase: coldStartPhaseSchema.Values.awaiting_plan_confirmation,
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
