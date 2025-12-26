import { HumanMessage } from "@langchain/core/messages";

import { targetContextSchema } from "../../../../shared/schemas.js";
import { getModel } from "../../shared-tools/models.js";
import { buildGoalExtractionPrompt } from "../prompts/extraction.js";
import { NODE, PHASE } from "../state.js";
import { withLogging } from "../with-logging.js";

import type { AdhocContextBase, FieldFilter, TargetContext } from "../../../../shared/schemas.js";
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
 * If user didn't specify role/domains/skills/countries → use current context.
 */
function fillFromContext(goal: TargetContext, ctx: AdhocContextBase | null): TargetContext {
  if (!ctx) return goal;

  return {
    position: goal.position,
    role: goal.role ?? toFilter(ctx.role),
    domains: goal.domains ?? toFilter(ctx.domains),
    skills: goal.skills ?? toFilter(ctx.skills),
    countries: goal.countries ?? toFilter(ctx.countryCode),
    languages: goal.languages,
  };
}

export const extractGoalNode = withLogging<SearchStateType>(
  NODE.extract_goal,
  async (state, _config, { dictionariesService }) => {
    const { messages, userResponse, clarificationText, adhocContext } = state;

    // Use clarificationText if userResponse is empty (clarify intent case)
    const textToExtract = userResponse || clarificationText || "";

    const hints = await dictionariesService.buildHints(["role", "position", "domain", "skill", "industry"]);
    const prompt = buildGoalExtractionPrompt(hints);

    const extracted = await extractionModel.invoke([
      { role: "system", content: prompt },
      { role: "user", content: textToExtract },
    ]);

    const rawGoal = extracted ? targetContextSchema.parse(extracted) : null;
    const extractedGoal = rawGoal ? fillFromContext(rawGoal, adhocContext) : null;

    return {
      extractedGoal,
      userResponse: "",
      phase: PHASE.showing_goal,
      messages: messages.length === 0 ? [new HumanMessage(userResponse)] : messages,
    };
  },
);
