import { getPendingAction } from "../services/pending-actions.js";

import { handleAddContextWithText } from "./add-context.js";
import { handleAddTrailWithText } from "./add-trail.js";
import { processAdhocQuery } from "./by-adhoc.js";
import { processCurrentQuery } from "./by-current.js";
import { processTargetQuery } from "./by-target.js";
import { handleSetGoalWithText } from "./set-goal.js";
import { handleStoryWithText } from "./story.js";
import { handleUpdateContextWithText } from "./update-context.js";

import type { BotContext, PendingAction } from "../types.js";

const handlers: Record<PendingAction, (ctx: BotContext, text: string) => Promise<void>> = {
  story: handleStoryWithText,
  by_target: processTargetQuery,
  by_adhoc: processAdhocQuery,
  by_current: processCurrentQuery,
  set_goal: handleSetGoalWithText,
  update_context: handleUpdateContextWithText,
  add_context: handleAddContextWithText,
  add_trail: handleAddTrailWithText,
};

export async function routeInput(ctx: BotContext, text: string): Promise<void> {
  const pendingAction = getPendingAction(ctx);

  if (!pendingAction) {
    await ctx.reply(ctx.t("action-required"));
    return;
  }

  await handlers[pendingAction](ctx, text);
}
