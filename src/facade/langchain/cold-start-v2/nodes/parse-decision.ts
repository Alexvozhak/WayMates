import { getModel } from "../../shared-tools/models.js";
import { decisionSchema } from "../state.js";

import type { ColdStartStateType } from "../state.js";

const intentParser = getModel("deterministic").withStructuredOutput(decisionSchema);

const CONFIRMATION_PROMPT = `Parse the user's intent from their message.

Rules:
- "да", "yes", "ok", "подтверждаю", "согласен", "верно", "approve", "давай", "норм", "пойдёт", "save", "сохрани", "сохранить" → approve
- "изменить", "edit", "поправить", "измени", "добавь", "убери" → edit
- "нет", "cancel", "отмена", "стоп", "выход", "stop" → cancel

Return structured JSON with:
- intent: "approve", "edit", or "cancel"
- editTarget: what to edit if intent is "edit" (empty string otherwise)
- editInstructions: how to edit if intent is "edit" (empty string otherwise)`;

const STORY_DECISION_PROMPT = `Determine if the user has finished telling their career story.

CRITICAL RULE: Default to "approve" unless the message is CLEARLY incomplete.

Rules (in priority order):
1. Explicit completion phrases → approve ALWAYS:
   "готово", "done", "that's all", "это всё", "вот и всё", "закончил", "всё", "finish", "конец"

2. Cancel phrases → cancel:
   "нет", "cancel", "отмена", "стоп", "выход", "stop"

3. Message length heuristic:
   - Message > 100 characters with ANY career details (dates, companies, positions, roles) → approve
   - Message < 50 characters without completion phrase → continue

4. Detailed career history → approve:
   If the message mentions specific years, companies, job titles, or career transitions → approve

Only return "continue" for:
- Very short greetings ("Hello", "Hi", "Привет")
- Questions without career content
- Messages that explicitly ask for more prompts

Return structured JSON with:
- intent: "approve" (story complete/detailed), "continue" (greeting/incomplete), or "cancel"
- editTarget: empty string
- editInstructions: empty string`;

export async function parseDecisionNode(state: ColdStartStateType): Promise<Partial<ColdStartStateType>> {
  const { userResponse } = state;

  const parsedDecision = await intentParser.invoke([
    { role: "system", content: CONFIRMATION_PROMPT },
    { role: "user", content: userResponse },
  ]);

  return { parsedDecision };
}

export async function parseStoryDecisionNode(state: ColdStartStateType): Promise<Partial<ColdStartStateType>> {
  const { userResponse } = state;

  const parsedDecision = await intentParser.invoke([
    { role: "system", content: STORY_DECISION_PROMPT },
    { role: "user", content: userResponse },
  ]);

  return { parsedDecision };
}
