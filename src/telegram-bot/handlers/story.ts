import { InlineKeyboard } from "grammy";

import { formatColdStartResult } from "../formatters/story.js";
import { callTool } from "../services/mcp-client.js";
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
  await ctx.reply(
    "📝 Расскажите о своей карьерной истории:\n\n" +
      "Например:\n" +
      "Работал backend разработчиком в Яндексе с 2020 по 2023, писал на Python и Go. " +
      "Потом перешёл в стартап на позицию Tech Lead...\n\n" +
      "💬 Вы можете отправить текст или голосовое сообщение.",
  );
}

async function sendStoryToAgent(ctx: BotContext, message: string): Promise<void> {
  const result = await callTool(ctx, "cold_start", { message });

  const keyboard = new InlineKeyboard()
    .text("✅ Подтвердить", "decision:approve")
    .text("✏️ Редактировать", "decision:edit")
    .row()
    .text("❌ Отмена", "decision:cancel");

  await ctx.reply(formatColdStartResult(result), { reply_markup: keyboard, parse_mode: "Markdown" });
}
