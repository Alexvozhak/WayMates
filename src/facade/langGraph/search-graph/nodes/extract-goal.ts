import { HumanMessage } from "@langchain/core/messages";

import { ADHOC_TO_TARGET_ENTRIES, targetContextSchema } from "../../../../shared/schemas.js";
import { getModel } from "../../shared-tools/models.js";
import { buildGoalExtractionPrompt } from "../prompts/extraction.js";
import { NODE, PHASE } from "../state.js";
import { withLogging } from "../with-logging.js";

import type { AdhocContextBase, FieldFilter, InheritableGoalField, TargetContext } from "../../../../shared/schemas.js";
import type { SearchStateType } from "../state.js";

const extractionModel = getModel("extraction").withStructuredOutput(targetContextSchema);

/**
 * Convert adhocContext field to FieldFilter format for goal.
 */
function toFilter(value: string | string[] | null | undefined): FieldFilter | null {
  if (value == null) return null;
  const values = Array.isArray(value) ? value : [value];
  return values.length > 0 ? { mode: "desired", values } : null;
}

/**
 * Fill missing goal fields from adhocContext using ADHOC_TO_TARGET_ENTRIES.
 * All fields (including position) can be inherited now.
 */
function fillFromContext(
  goal: TargetContext,
  ctx: AdhocContextBase | null,
): { filled: TargetContext; inherited: InheritableGoalField[] } {
  if (!ctx) return { filled: goal, inherited: [] };

  const inherited: InheritableGoalField[] = [];
  const filled = { ...goal };

  for (const [adhocKey, targetKey] of ADHOC_TO_TARGET_ENTRIES) {
    if (filled[targetKey] != null) continue;

    const filterValue = toFilter(ctx[adhocKey]);
    if (filterValue == null) continue;

    filled[targetKey] = filterValue;
    inherited.push(targetKey);
  }

  return { filled, inherited };
}

export const extractGoalNode = withLogging<SearchStateType>(
  NODE.extract_goal,
  async (state, _config, { dictionariesService }) => {
    const { messages, userResponse, adhocContext } = state;
    const textToExtract = userResponse || "";

    const hints = await dictionariesService.buildHints(["role", "position", "domain", "skill", "industry"]);
    const prompt = buildGoalExtractionPrompt(hints);

    const extracted = await extractionModel.invoke([
      { role: "system", content: prompt },
      { role: "user", content: textToExtract },
    ]);

    const rawGoal = extracted ? targetContextSchema.parse(extracted) : null;
    const { filled: extractedGoal, inherited: inheritedGoalFields } = rawGoal
      ? fillFromContext(rawGoal, adhocContext)
      : { filled: null, inherited: [] };

    return {
      extractedGoal,
      inheritedGoalFields,
      userResponse: "",
      phase: PHASE.showing_goal,
      messages: messages.length === 0 ? [new HumanMessage(userResponse)] : messages,
    };
  },
);
