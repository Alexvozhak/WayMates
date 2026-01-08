import { HumanMessage } from "@langchain/core/messages";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";

import { contextAgendaBaseSchema } from "../../../../shared/schemas.js";
import { logger } from "../../../logger.js";
import { withReasoning } from "../../../utils/llm-schemas.js";
import { getModel } from "../../shared-tools/models.js";
import { planningPrompt } from "../prompts.js";
import { PHASE } from "../state.js";

import type { ColdStartStateType, ContextAgenda, ContextAgendaBase } from "../state.js";

const planOutputSchema = withReasoning(
  z.object({
    contexts: z.array(contextAgendaBaseSchema),
  }),
  "List the career positions you identified chronologically",
);

const planningModel = getModel("planning").withStructuredOutput(planOutputSchema);

function formatPreview(startYear: number, endYear: number | null, title: string): string {
  const end = endYear ?? "present";
  return `${startYear}-${end}: ${title}`;
}

function generateContextIds(contexts: ContextAgendaBase[]): ContextAgenda[] {
  return contexts.map((ctx) => ({
    contextId: `ctx_${uuidv7()}`,
    startYear: ctx.startYear,
    endYear: ctx.endYear,
    title: ctx.title,
    preview: formatPreview(ctx.startYear, ctx.endYear, ctx.title),
    incomingTrails: ctx.incomingTrails,
  }));
}

export async function planCareerNode(state: ColdStartStateType): Promise<Partial<ColdStartStateType>> {
  const { messages, cvText } = state;

  const prompt = planningPrompt(messages, cvText);
  const { reasoning, ...planOutput } = await planningModel.invoke([new HumanMessage(prompt)]);
  logger.info({ reasoning }, "plan career reasoning");

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
