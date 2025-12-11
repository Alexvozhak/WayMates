import { Api } from "grammy";

import { logger } from "../logger.js";
import { clearPendingAction, setPendingAction } from "../services/pending-actions.js";

import type { BotContext } from "../types.js";

export async function handleFeedback(ctx: BotContext): Promise<void> {
  const message = ctx.message?.text?.replace("/feedback", "").trim();
  await processFeedback(ctx, message);
}

export async function handleFeedbackWithText(ctx: BotContext, text: string): Promise<void> {
  await processFeedback(ctx, text);
}

async function processFeedback(ctx: BotContext, message: string | undefined): Promise<void> {
  if (!message) {
    setPendingAction(ctx, "feedback");
    await ctx.reply(ctx.t("feedback-prompt"));
    return;
  }

  clearPendingAction(ctx);
  await sendFeedbackToChannel(ctx, message);
}

async function sendFeedbackToChannel(ctx: BotContext, message: string): Promise<void> {
  const { feedbackChatId } = ctx.services;

  if (!feedbackChatId) {
    logger.warn("FEEDBACK_CHAT_ID not configured, feedback not sent");
    await ctx.reply(ctx.t("feedback-sent"));
    return;
  }

  const sessionId = await ctx.services.sessionService.getSessionId(ctx);
  const username = ctx.from?.username ? `@${ctx.from.username}` : `ID: ${ctx.from?.id}`;
  const timestamp = new Date().toISOString().replace("T", " ").slice(0, 16);

  const feedbackText = [
    `🐛 Feedback от ${username}`,
    "",
    message,
    "",
    `📋 Session: ${sessionId}`,
    `⏰ ${timestamp}`,
  ].join("\n");

  const api = new Api(ctx.services.botToken);
  await api.sendMessage(feedbackChatId, feedbackText);

  await ctx.reply(ctx.t("feedback-sent"));
}
