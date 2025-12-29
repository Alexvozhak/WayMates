import { HumanMessage } from "@langchain/core/messages";

import { targetContextSchema } from "../../../../shared/schemas.js";
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
 * Fill missing goal fields from adhocContext.
 * Returns filled goal and list of inherited field names.
 */
function fillFromContext(
  goal: TargetContext,
  ctx: AdhocContextBase | null,
): { filled: TargetContext; inherited: InheritableGoalField[] } {
  if (!ctx) return { filled: goal, inherited: [] };

  const inherited: InheritableGoalField[] = [];
  const inherit = <T>(field: InheritableGoalField, goalVal: T, ctxVal: T): T => {
    if (goalVal != null) return goalVal;
    if (ctxVal != null) inherited.push(field);
    return ctxVal;
  };

  return {
    filled: {
      position: goal.position,
      role: inherit("role", goal.role, toFilter(ctx.role)),
      domains: inherit("domains", goal.domains, toFilter(ctx.domains)),
      skills: inherit("skills", goal.skills, toFilter(ctx.skills)),
      countries: inherit("countries", goal.countries, toFilter(ctx.countryCode)),
      languages: inherit("languages", goal.languages, toFilter(ctx.languages)),
    },
    inherited,
  };
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
