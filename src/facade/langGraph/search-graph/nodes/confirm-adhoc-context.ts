import { interrupt } from "@langchain/langgraph";

import { NODE, PHASE } from "../state.js";
import { withLogging } from "../with-logging.js";

import type { AdhocContextBase, Goal } from "../../../../shared/schemas.js";
import type { SearchStateType } from "../state.js";

// eslint-disable-next-line complexity -- simple field concatenation
function formatAdhocContext(ctx: AdhocContextBase): string {
  const parts: string[] = [];

  if (ctx.position) parts.push(ctx.position);
  if (ctx.role) parts.push(ctx.role);
  if (ctx.domains?.length) parts.push(ctx.domains.join(", "));
  if (ctx.skills?.length) parts.push(`навыки: ${ctx.skills.join(", ")}`);
  if (ctx.countryCode) parts.push(ctx.countryCode);

  return parts.join(", ") || "контекст не указан";
}

// eslint-disable-next-line complexity -- simple field concatenation
function formatGoal(goal: Goal): string {
  const parts: string[] = [];
  const tc = goal.targetContext;

  if (tc.position?.values?.[0]) parts.push(tc.position.values[0]);
  if (tc.role?.values?.[0]) parts.push(tc.role.values[0]);
  if (tc.domains?.values?.length) parts.push(tc.domains.values.join(", "));

  return parts.join(" ") || "цель";
}

function buildConfirmMessage(ctx: AdhocContextBase, goal: Goal | null): string {
  const contextStr = formatAdhocContext(ctx);

  if (goal) {
    const goalStr = formatGoal(goal);
    return `Окей, ${contextStr}. Твоя цель — ${goalStr}. Ищем пути к цели? Или хочешь изменить/уточнить?`;
  }

  return `Окей, ${contextStr}. Цели пока нет — есть готовая или помочь сформулировать? Или хочешь глянуть похожих на тебя ребят?`;
}

/**
 * Confirm adhoc context node: shows extracted context and asks what to do next.
 * Loads goal from DB and presents options based on whether goal exists.
 */
export const confirmAdhocContextNode = withLogging<SearchStateType>(
  NODE.confirm_adhoc_context,
  async (state, _config, { coreClient }) => {
    // Load goal from DB
    let storedGoal: Goal | null = null;
    try {
      storedGoal = await coreClient.client.goal.getByUser.query({ userId: state.userId });
    } catch {
      storedGoal = null;
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- adhocContext guaranteed by routing
    const message = buildConfirmMessage(state.adhocContext!, storedGoal);

    const userResponse = interrupt({
      type: "confirm_adhoc_context",
      message,
      phase: PHASE.confirming_adhoc_context,
      adhocContext: state.adhocContext,
      hasGoal: storedGoal !== null,
    });

    return {
      userResponse: String(userResponse),
      storedGoal,
      phase: PHASE.confirming_adhoc_context,
    };
  },
);
