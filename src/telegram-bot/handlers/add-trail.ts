import { InlineKeyboard } from "grammy";

import { clearPendingAction, setPendingAction } from "../services/pending-actions.js";

import type { BotContext } from "../types.js";

export async function handleAddTrail(ctx: BotContext): Promise<void> {
  const message = ctx.message?.text?.replace("/add_trail", "").trim();
  await processAddTrailMessage(ctx, message);
}

export async function handleAddTrailWithText(ctx: BotContext, text: string): Promise<void> {
  await processAddTrailMessage(ctx, text);
}

async function processAddTrailMessage(ctx: BotContext, message: string | undefined): Promise<void> {
  if (!message) {
    await showAddTrailPrompt(ctx);
    return;
  }

  clearPendingAction(ctx);
  await sendAddTrailToAgent(ctx, message);
}

async function showAddTrailPrompt(ctx: BotContext): Promise<void> {
  setPendingAction(ctx, "add_trail");
  await ctx.reply(ctx.t("add-trail-prompt"));
}

async function sendAddTrailToAgent(ctx: BotContext, message: string): Promise<void> {
  const sessionId = await ctx.services.sessionService.getSessionId(ctx);

  const result = await ctx.services.mcpClient.callTool("upsert_trail", {
    message,
    sessionId,
  });

  const keyboard = new InlineKeyboard()
    .text(ctx.t("button-approve"), "upsert_trail:approve")
    .text(ctx.t("button-edit"), "upsert_trail:edit")
    .row()
    .text(ctx.t("button-cancel"), "upsert_trail:cancel");

  const formattedMessage = await ctx.services.langGraphPresenter.format(result, ctx.from?.language_code);

  await ctx.reply(formattedMessage, { reply_markup: keyboard, parse_mode: "Markdown" });
}
