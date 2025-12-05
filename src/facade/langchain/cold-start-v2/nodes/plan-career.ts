import { HumanMessage } from "@langchain/core/messages";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";

import { getModel } from "../../shared-tools/models.js";
import { planningPrompt } from "../prompts.js";
import { PHASE } from "../state.js";
import { contextAgendaBaseSchema } from "../types.js";

import type { ColdStartStateType, ContextAgenda, ContextAgendaBase } from "../state.js";

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

export async function planCareerNode(state: ColdStartStateType): Promise<Partial<ColdStartStateType>> {
  const { messages } = state;

  const prompt = planningPrompt(messages);
  const planOutput = await planningModel.invoke([new HumanMessage(prompt)]);

  if (!planOutput || planOutput.contexts.length === 0) {
    return {
      phase: PHASE.failed,
      queue: [],
    };
  }

  const queue = generateContextIds(planOutput.contexts);

  return {
    phase: PHASE.awaiting_plan_confirmation,
    queue,
    currentContextIndex: 0,
  };
}
