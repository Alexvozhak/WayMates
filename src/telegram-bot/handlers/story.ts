import { InlineKeyboard } from "grammy";

import { clearPendingAction, setPendingAction } from "../services/pending-actions.js";

import type { BotContext } from "../types.js";

export async function handleStory(ctx: BotContext): Promise<void> {
  const message = ctx.message?.text?.replace("/story", "").trim();
  await processStoryMessage(ctx, message);
}

export async function handleStoryWithText(ctx: BotContext, text: string): Promise<void> {
  await processStoryMessage(ctx, text);
}

async function processStoryMessage(ctx: BotContext, message: string | undefined): Promise<void> {
  if (!message) {
    await showStoryPrompt(ctx);
    return;
  }

  clearPendingAction(ctx);
  await sendStoryToAgent(ctx, message);
}

async function showStoryPrompt(ctx: BotContext): Promise<void> {
  setPendingAction(ctx, "story");
  await ctx.reply(ctx.t("story-prompt"));
}

async function sendStoryToAgent(ctx: BotContext, message: string): Promise<void> {
  const sessionId = await ctx.services.sessionService.getSessionId(ctx);

  const result = await ctx.services.mcpClient.callTool("cold_start", { message, sessionId });

  const keyboard = new InlineKeyboard()
    .text(ctx.t("button-approve"), "decision:approve")
    .text(ctx.t("button-edit"), "decision:edit")
    .row()
    .text(ctx.t("button-cancel"), "decision:cancel");

  const formattedMessage = await ctx.services.langGraphPresenter.format(result, ctx.from?.language_code);

  await ctx.reply(formattedMessage, { reply_markup: keyboard, parse_mode: "Markdown" });
}
