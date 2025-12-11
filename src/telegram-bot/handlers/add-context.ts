import { InlineKeyboard } from "grammy";

import { clearPendingAction, setPendingAction } from "../services/pending-actions.js";

import type { BotContext } from "../types.js";

export async function handleAddContext(ctx: BotContext): Promise<void> {
  const message = ctx.message?.text?.replace("/add_context", "").trim();
  await processAddContextMessage(ctx, message);
}

export async function handleAddContextWithText(ctx: BotContext, text: string): Promise<void> {
  await processAddContextMessage(ctx, text);
}

async function processAddContextMessage(ctx: BotContext, message: string | undefined): Promise<void> {
  if (!message) {
    await showAddContextPrompt(ctx);
    return;
  }

  clearPendingAction(ctx);
  await sendAddContextToAgent(ctx, message);
}

async function showAddContextPrompt(ctx: BotContext): Promise<void> {
  setPendingAction(ctx, "add_context");
  await ctx.reply(ctx.t("add-context-prompt"));
}

async function sendAddContextToAgent(ctx: BotContext, message: string): Promise<void> {
  const sessionId = await ctx.services.sessionService.getSessionId(ctx);

  const result = await ctx.services.mcpClient.callTool("upsert_context", {
    message,
    sessionId,
  });

  const keyboard = new InlineKeyboard()
    .text(ctx.t("button-approve"), "upsert_context:approve")
    .text(ctx.t("button-edit"), "upsert_context:edit")
    .row()
    .text(ctx.t("button-cancel"), "upsert_context:cancel");

  const formattedMessage = await ctx.services.langGraphPresenter.format(result, ctx.from?.language_code);

  await ctx.reply(formattedMessage, { reply_markup: keyboard, parse_mode: "Markdown" });
}
