import { clearPendingAction, getPendingAction } from "../services/pending-actions.js";
import { transcribeVoice } from "../services/whisper.js";

import { handleSearchWithText } from "./search.js";
import { handleStoryWithText } from "./story.js";

import type { BotContext } from "../types.js";

const ACTION_REQUIRED_MESSAGE =
  "⚠️ Сначала выберите действие:\n\n" + "/story — Рассказать карьерную историю\n" + "/search — Найти карьерные пути";

export async function handleVoice(ctx: BotContext): Promise<void> {
  const pendingAction = getPendingAction(ctx);

  if (!pendingAction) {
    await ctx.reply(ACTION_REQUIRED_MESSAGE);
    return;
  }

  const fileId = ctx.message?.voice?.file_id;
  if (!fileId) {
    return;
  }

  const text = await transcribeVoice(ctx, fileId);
  clearPendingAction(ctx);

  if (pendingAction === "story") {
    await handleStoryWithText(ctx, text);
  } else if (pendingAction === "search") {
    await handleSearchWithText(ctx, text);
  }
}
