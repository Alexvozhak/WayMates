import path from "node:path";
import { fileURLToPath } from "node:url";

import { autoRetry } from "@grammyjs/auto-retry";
import { hydrate } from "@grammyjs/hydrate";
import { I18n } from "@grammyjs/i18n";
import { Bot } from "grammy";

import { captureException } from "../shared/sentry.js";

import { BotError, McpClientError, SessionError } from "./errors.js";
import { handleConverse } from "./handlers/converse.js";
import { handleDocument } from "./handlers/document.js";
import { handleLink } from "./handlers/link.js";
import { handleStart } from "./handlers/start.js";
import { handleToken } from "./handlers/token.js";
import { handleVoice } from "./handlers/voice.js";
import { createRateLimitMiddleware } from "./middleware/rate-limit.js";
import { timingMiddleware } from "./middleware/timing.js";

import type { BotEnv } from "./env.js";
import type { BotContext, BotServices } from "./types.js";
import type { BotError as GrammyBotError } from "grammy";
import type { Logger } from "pino";

async function userInfoMiddleware(ctx: BotContext, next: () => Promise<void>): Promise<void> {
  const telegramUserId = ctx.from?.id;
  if (!telegramUserId) {
    throw new SessionError("Telegram user ID not found");
  }

  ctx.userInfo = await ctx.services.sessionService.getUserInfo(telegramUserId, ctx.requestId);
  await next();
}

export function createBot(token: string, services: BotServices, env: BotEnv, logger: Logger): Bot<BotContext> {
  const bot = new Bot<BotContext>(token);

  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const i18n = new I18n<BotContext>({
    defaultLocale: "en",
    directory: path.join(currentDir, "locales"),
  });

  bot.api.config.use(autoRetry());

  bot.use(i18n);
  bot.use(hydrate());

  bot.use(async (ctx, next) => {
    ctx.services = services;
    await next();
  });

  bot.use(timingMiddleware);
  bot.use(userInfoMiddleware);

  // Rate limiting for user spam protection
  bot.use(createRateLimitMiddleware(env.USER_RATE_LIMIT_WINDOW_MS, env.USER_RATE_LIMIT_MAX_REQUESTS));

  // Register commands
  bot.command("start", handleStart);
  bot.command("link", handleLink);
  bot.command("token", handleToken);

  // Unified text message handler — routes through converse.tool
  bot.on("message:text", handleConverse);
  bot.on("message:voice", handleVoice);
  bot.on("message:document", handleDocument);

  bot.catch((error) => handleGlobalError(error, logger));

  return bot;
}

async function handleGlobalError(error: GrammyBotError<BotContext>, logger: Logger): Promise<void> {
  const ctx = error.ctx;

  if (error.error instanceof McpClientError && error.error.code) {
    await ctx.reply(ctx.t(`error-${error.error.code}`));
    return;
  }

  if (error.error instanceof BotError) {
    await ctx.reply(`❌ ${error.error.message}`);
    return;
  }

  const tags = ctx.userInfo
    ? { telegramUserId: String(ctx.from?.id), userId: ctx.userInfo.userId, sessionId: ctx.userInfo.sessionId }
    : { telegramUserId: String(ctx.from?.id) };
  captureException(error.error, tags);
  logger.error({ err: error.error, ...tags }, "Unhandled error");
  await ctx.reply(ctx.t("error-generic"));
}
