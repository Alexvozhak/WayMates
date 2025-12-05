import { clearPendingAction, getPendingAction } from "../services/pending-actions.js";

import { handleSearchWithText } from "./search.js";
import { handleStoryWithText } from "./story.js";

import type { BotContext } from "../types.js";

const ACTION_REQUIRED_MESSAGE =
  "⚠️ Сначала выберите действие:\n\n" + "/story — Рассказать карьерную историю\n" + "/search — Найти карьерные пути";

export async function handleText(ctx: BotContext): Promise<void> {
  const pendingAction = getPendingAction(ctx);

  if (!pendingAction) {
    await ctx.reply(ACTION_REQUIRED_MESSAGE);
    return;
  }

  const text = ctx.message?.text;
  if (!text) {
    return;
  }

  clearPendingAction(ctx);

  if (pendingAction === "story") {
    await handleStoryWithText(ctx, text);
  } else if (pendingAction === "search") {
    await handleSearchWithText(ctx, text);
  }
}
