import { InlineKeyboard } from "grammy";

import { clearPendingAction, setPendingAction } from "../services/pending-actions.js";

import type { BotContext } from "../types.js";

export async function handleUpdateContext(ctx: BotContext): Promise<void> {
  const message = ctx.message?.text?.replace("/update_context", "").trim();
  await processUpdateContextMessage(ctx, message);
}

export async function handleUpdateContextWithText(ctx: BotContext, text: string): Promise<void> {
  await processUpdateContextMessage(ctx, text);
}

async function processUpdateContextMessage(ctx: BotContext, message: string | undefined): Promise<void> {
  if (!message) {
    await showUpdateContextPrompt(ctx);
    return;
  }

  clearPendingAction(ctx);
  await sendUpdateContextToAgent(ctx, message);
}

async function showUpdateContextPrompt(ctx: BotContext): Promise<void> {
  setPendingAction(ctx, "update_context");
  await ctx.reply(ctx.t("update-context-prompt"));
}

async function sendUpdateContextToAgent(ctx: BotContext, message: string): Promise<void> {
  const sessionId = await ctx.services.sessionService.getSessionId(ctx);

  const result = await ctx.services.mcpClient.callTool("update_context", {
    message,
    sessionId,
  });

  const keyboard = new InlineKeyboard()
    .text(ctx.t("button-approve"), "update_context:approve")
    .text(ctx.t("button-edit"), "update_context:edit")
    .row()
    .text(ctx.t("button-cancel"), "update_context:cancel");

  const formattedMessage = await ctx.services.langGraphPresenter.format(result, ctx.from?.language_code);

  await ctx.reply(formattedMessage, { reply_markup: keyboard, parse_mode: "Markdown" });
}
