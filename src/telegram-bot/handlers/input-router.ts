import { clearPendingAction, getPendingAction } from "../services/pending-actions.js";

import { processAdhocQuery } from "./by-adhoc.js";
import { processCurrentQuery } from "./by-current.js";
import { processTargetQuery } from "./by-target.js";
import { handleStoryWithText } from "./story.js";

import type { BotContext, PendingAction } from "../types.js";

const handlers: Record<PendingAction, (ctx: BotContext, text: string) => Promise<void>> = {
  story: handleStoryWithText,
  by_target: processTargetQuery,
  by_adhoc: processAdhocQuery,
  by_current: processCurrentQuery,
};

export async function routeInput(ctx: BotContext, text: string): Promise<void> {
  const pendingAction = getPendingAction(ctx);

  if (!pendingAction) {
    await ctx.reply(ctx.t("action-required"));
    return;
  }

  clearPendingAction(ctx);
  await handlers[pendingAction](ctx, text);
}
