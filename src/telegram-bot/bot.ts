import path from "node:path";
import { fileURLToPath } from "node:url";

import { autoRetry } from "@grammyjs/auto-retry";
import { hydrate } from "@grammyjs/hydrate";
import { I18n } from "@grammyjs/i18n";
import { RedisAdapter } from "@grammyjs/storage-redis";
import { Bot, session } from "grammy";

import { BotError } from "./errors.js";
import { handleByAdhoc } from "./handlers/by-adhoc.js";
import { handleByCurrent } from "./handlers/by-current.js";
import { handleByTarget } from "./handlers/by-target.js";
import { handleApproveCallback, handleCancelCallback, handleEditCallback } from "./handlers/callbacks.js";
import { handleCancel } from "./handlers/cancel.js";
import { handleHelp } from "./handlers/help.js";
import { routeInput } from "./handlers/input-router.js";
import { handleLink } from "./handlers/link.js";
import { handleStart } from "./handlers/start.js";
import { handleStory } from "./handlers/story.js";
import { handleToken } from "./handlers/token.js";
import { handleVoice } from "./handlers/voice.js";
import { logger } from "./logger.js";

import type { BotContext, BotServices, MySessionData } from "./types.js";
import type { Redis } from "ioredis";

const STORY_REQUIRED_COMMANDS = new Set(["/goal", "/context", "/trail", "/by_current"]);

function isStoryRequiredCommand(ctx: BotContext): boolean {
  const messageText = ctx.message?.text ?? "";
  const command = messageText.split(" ")[0] ?? "";
  return STORY_REQUIRED_COMMANDS.has(command);
}

function userHasStory(ctx: BotContext): boolean {
  return ctx.session.status === "initialised" && ctx.session.hasStory;
}

async function storyRequiredGuard(ctx: BotContext, next: () => Promise<void>): Promise<void> {
  if (!isStoryRequiredCommand(ctx) || userHasStory(ctx)) {
    await next();
    return;
  }

  await ctx.reply(ctx.t("story-required"));
}

export function createBot(token: string, services: BotServices, redis: Redis): Bot<BotContext> {
  const bot = new Bot<BotContext>(token);

  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const i18n = new I18n<BotContext>({
    defaultLocale: "en",
    directory: path.join(currentDir, "locales"),
  });

  const storage = new RedisAdapter<MySessionData>({
    instance: redis,
    ttl: 604_800, // 7 days
  });

  bot.api.config.use(autoRetry());

  bot.use(i18n);
  bot.use(hydrate());

  bot.use(
    session({
      initial: (): MySessionData => ({ status: "uninitialised" }),
      storage,
    }),
  );

  bot.use(async (ctx, next) => {
    ctx.services = services;
    await next();
  });

  bot.use(storyRequiredGuard);

  bot.command("start", handleStart);
  bot.command("help", handleHelp);
  bot.command("story", handleStory);
  bot.command("by_target", handleByTarget);
  bot.command("by_current", handleByCurrent);
  bot.command("by_adhoc", handleByAdhoc);
  bot.command("link", handleLink);
  bot.command("cancel", handleCancel);
  bot.command("token", handleToken);

  bot.callbackQuery("decision:approve", handleApproveCallback);
  bot.callbackQuery("decision:edit", handleEditCallback);
  bot.callbackQuery("decision:cancel", handleCancelCallback);

  bot.on("message:text", async (ctx) => {
    const text = ctx.message?.text;
    if (!text) return;
    await routeInput(ctx, text);
  });
  bot.on("message:voice", handleVoice);

  bot.catch(async (error) => {
    const ctx = error.ctx;

    if (error.error instanceof BotError) {
      await ctx.reply(`❌ ${error.error.message}`);
      return;
    }

    logger.error({ err: error.error }, "Unhandled error");
    await ctx.reply(ctx.t("error-generic"));
  });

  return bot;
}
