import path from "node:path";
import { fileURLToPath } from "node:url";

import { autoRetry } from "@grammyjs/auto-retry";
import { hydrate } from "@grammyjs/hydrate";
import { I18n } from "@grammyjs/i18n";
import { RedisAdapter } from "@grammyjs/storage-redis";
import { Bot, session } from "grammy";

import { BotError, McpClientError } from "./errors.js";
import { handleByAdhoc } from "./handlers/by-adhoc.js";
import { handleByCurrent } from "./handlers/by-current.js";
import { handleByTarget } from "./handlers/by-target.js";
import { handleApproveCallback, handleCancelCallback, handleEditCallback } from "./handlers/callbacks.js";
import { handleCancel } from "./handlers/cancel.js";
import { handleContext } from "./handlers/context-router.js";
import { handleGetStory } from "./handlers/get-story.js";
import { handleGoal } from "./handlers/goal-router.js";
import { handleHelp } from "./handlers/help.js";
import { routeInput } from "./handlers/input-router.js";
import {
  handleUpdateContextApprove,
  handleUpdateContextCancel,
  handleUpdateContextEdit,
  handleUpsertContextApprove,
  handleUpsertContextCancel,
  handleUpsertContextEdit,
  handleUpsertTrailApprove,
  handleUpsertTrailCancel,
  handleUpsertTrailEdit,
} from "./handlers/langgraph-callbacks.js";
import { handleLink } from "./handlers/link.js";
import { handleStart } from "./handlers/start.js";
import { handleStory } from "./handlers/story.js";
import { handleToken } from "./handlers/token.js";
import { handleTrail } from "./handlers/trail-router.js";
import { handleVoice } from "./handlers/voice.js";
import { logger } from "./logger.js";
import { createRateLimitMiddleware } from "./middleware/rate-limit.js";
import { clearPendingAction } from "./services/pending-actions.js";

import type { BotEnv } from "./env.js";
import type { BotContext, BotServices, MySessionData } from "./types.js";
import type { Redis } from "ioredis";

const STORY_REQUIRED_COMMANDS = new Set(["/context", "/trail", "/by_current"]);

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

async function sessionInitGuard(ctx: BotContext, next: () => Promise<void>): Promise<void> {
  if (ctx.session.status === "uninitialised") {
    await ctx.services.sessionService.initialize(ctx);
  }
  await next();
}

async function callbackSessionGuard(ctx: BotContext, next: () => Promise<void>): Promise<void> {
  if (ctx.session.status === "uninitialised") {
    await ctx.answerCallbackQuery({ text: "Session expired" });
    await ctx.editMessageText(ctx.t("error-session_expired"));
    return;
  }
  await next();
}

function registerCommands(bot: Bot<BotContext>): void {
  bot.command("start", handleStart);
  bot.command("help", handleHelp);
  bot.command("story", handleStory);
  bot.command("get_story", handleGetStory);
  bot.command("goal", handleGoal);
  bot.command("context", handleContext);
  bot.command("trail", handleTrail);
  bot.command("by_target", handleByTarget);
  bot.command("by_current", handleByCurrent);
  bot.command("by_adhoc", handleByAdhoc);
  bot.command("link", handleLink);
  bot.command("cancel", handleCancel);
  bot.command("token", handleToken);
}

function registerCallbacks(bot: Bot<BotContext>): void {
  bot.callbackQuery(/^decision:/, callbackSessionGuard);
  bot.callbackQuery("decision:approve", handleApproveCallback);
  bot.callbackQuery("decision:edit", handleEditCallback);
  bot.callbackQuery("decision:cancel", handleCancelCallback);

  bot.callbackQuery(/^update_context:/, callbackSessionGuard);
  bot.callbackQuery("update_context:approve", handleUpdateContextApprove);
  bot.callbackQuery("update_context:edit", handleUpdateContextEdit);
  bot.callbackQuery("update_context:cancel", handleUpdateContextCancel);

  bot.callbackQuery(/^upsert_context:/, callbackSessionGuard);
  bot.callbackQuery("upsert_context:approve", handleUpsertContextApprove);
  bot.callbackQuery("upsert_context:edit", handleUpsertContextEdit);
  bot.callbackQuery("upsert_context:cancel", handleUpsertContextCancel);

  bot.callbackQuery(/^upsert_trail:/, callbackSessionGuard);
  bot.callbackQuery("upsert_trail:approve", handleUpsertTrailApprove);
  bot.callbackQuery("upsert_trail:edit", handleUpsertTrailEdit);
  bot.callbackQuery("upsert_trail:cancel", handleUpsertTrailCancel);
}

export function createBot(token: string, services: BotServices, redis: Redis, env: BotEnv): Bot<BotContext> {
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

  bot.use(sessionInitGuard);

  // Rate limiting for user spam protection
  bot.use(createRateLimitMiddleware(env.USER_RATE_LIMIT_WINDOW_MS, env.USER_RATE_LIMIT_MAX_REQUESTS));

  bot.use(storyRequiredGuard);

  registerCommands(bot);
  registerCallbacks(bot);

  bot.on("message:text", async (ctx) => {
    const text = ctx.message?.text;
    if (!text) return;
    await routeInput(ctx, text);
  });
  bot.on("message:voice", handleVoice);

  bot.catch(async (error) => {
    const ctx = error.ctx;

    // Clear pending action to prevent state leak
    clearPendingAction(ctx);

    if (error.error instanceof McpClientError && error.error.code) {
      await ctx.reply(ctx.t(`error-${error.error.code}`));
      return;
    }

    if (error.error instanceof BotError) {
      await ctx.reply(`❌ ${error.error.message}`);
      return;
    }

    logger.error({ err: error.error }, "Unhandled error");
    await ctx.reply(ctx.t("error-generic"));
  });

  return bot;
}
