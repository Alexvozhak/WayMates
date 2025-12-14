import { setPendingAction } from "../services/pending-actions.js";

import type { BotContext } from "../types.js";

export async function handleApproveCallback(ctx: BotContext): Promise<void> {
  await ctx.answerCallbackQuery({ text: ctx.t("callback-processing") });
  if (ctx.callbackQuery?.message?.reply_markup) {
    await ctx.editMessageReplyMarkup();
  }

  const sessionId = await ctx.services.sessionService.getSessionId(ctx);
  const result = await ctx.services.mcpClient.callTool("cold_start", { message: "да", sessionId });

  if (result.phase === "saved") {
    await ctx.editMessageText(ctx.t("story-approved", { message: ctx.t("story-saved-success") }));
    return;
  }

  await ctx.editMessageText(ctx.t("story-confirmed"));
}

export async function handleEditCallback(ctx: BotContext): Promise<void> {
  await ctx.answerCallbackQuery();
  if (ctx.callbackQuery?.message?.reply_markup) {
    await ctx.editMessageReplyMarkup();
  }
  setPendingAction(ctx, "story");
  await ctx.editMessageText(ctx.t("story-edit-prompt"));
}

export async function handleCancelCallback(ctx: BotContext): Promise<void> {
  await ctx.answerCallbackQuery();
  if (ctx.callbackQuery?.message?.reply_markup) {
    await ctx.editMessageReplyMarkup();
  }

  const sessionId = await ctx.services.sessionService.getSessionId(ctx);
  await ctx.services.mcpClient.callTool("reset_cold_start", { sessionId });

  await ctx.editMessageText(ctx.t("story-cancelled"));
}
