import { Bot } from "grammy";

import { BotError } from "./errors.js";
import { handleApproveCallback, handleCancelCallback, handleEditCallback } from "./handlers/callbacks.js";
import { handleCancel } from "./handlers/cancel.js";
import { handleHelp } from "./handlers/help.js";
import { handleLink } from "./handlers/link.js";
import { handleSearch } from "./handlers/search.js";
import { handleStart } from "./handlers/start.js";
import { handleStory } from "./handlers/story.js";
import { handleText } from "./handlers/text.js";
import { handleToken } from "./handlers/token.js";
import { handleVoice } from "./handlers/voice.js";
import { logger } from "./logger.js";

import type { BotContext, BotServices, PendingActionStorage, SessionStorage } from "./types.js";

const STORY_REQUIRED_COMMANDS = new Set(["/goal", "/context", "/trail"]);
const STORY_REQUIRED_MESSAGE = "⚠️ Сначала расскажите свою карьерную историю!\n\n" + "Используйте /story чтобы начать.";

function isStoryRequiredCommand(ctx: BotContext): boolean {
  const messageText = ctx.message?.text ?? "";
  const command = messageText.split(" ")[0] ?? "";
  return STORY_REQUIRED_COMMANDS.has(command);
}

function userHasStory(ctx: BotContext): boolean {
  const telegramUserId = ctx.from?.id;
  if (!telegramUserId) return true;
  return ctx.sessions.get(telegramUserId)?.hasStory ?? false;
}

async function storyRequiredGuard(ctx: BotContext, next: () => Promise<void>): Promise<void> {
  if (!isStoryRequiredCommand(ctx) || userHasStory(ctx)) {
    await next();
    return;
  }

  await ctx.reply(STORY_REQUIRED_MESSAGE);
}

export function createBot(token: string, services: BotServices): Bot<BotContext> {
  const bot = new Bot<BotContext>(token);

  const sessions: SessionStorage = new Map();
  const pendingActions: PendingActionStorage = new Map();

  bot.use(async (ctx, next) => {
    ctx.services = services;
    ctx.sessions = sessions;
    ctx.pendingActions = pendingActions;
    await next();
  });

  bot.use(storyRequiredGuard);

  bot.command("start", handleStart);
  bot.command("help", handleHelp);
  bot.command("story", handleStory);
  bot.command("search", handleSearch);
  bot.command("link", handleLink);
  bot.command("cancel", handleCancel);
  bot.command("token", handleToken);

  bot.callbackQuery("decision:approve", handleApproveCallback);
  bot.callbackQuery("decision:edit", handleEditCallback);
  bot.callbackQuery("decision:cancel", handleCancelCallback);

  bot.on("message:text", handleText);
  bot.on("message:voice", handleVoice);

  bot.catch(async (error) => {
    const ctx = error.ctx;

    if (error.error instanceof BotError) {
      await ctx.reply(`❌ ${error.error.message}`);
      return;
    }

    logger.error({ err: error.error }, "Unhandled error");
    await ctx.reply("❌ An unexpected error occurred. Please try again later.");
  });

  return bot;
}
