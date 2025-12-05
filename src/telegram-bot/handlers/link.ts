import { callTool } from "../services/mcp-client.js";
import { parseJsonContent } from "../services/mcp-utils.js";

import type { BotContext } from "../types.js";

export async function handleLink(ctx: BotContext): Promise<void> {
  const token = ctx.message?.text?.replace("/link", "").trim();

  if (!token) {
    await showLinkUsage(ctx);
    return;
  }

  const telegramUserId = ctx.from?.id;
  if (!telegramUserId) {
    await ctx.reply("❌ Не удалось получить ваш Telegram ID");
    return;
  }

  await performLinking(ctx, token, telegramUserId);
}

async function showLinkUsage(ctx: BotContext): Promise<void> {
  await ctx.reply(
    "🔗 Привязка LibreChat аккаунта\n\n" +
      "Использование:\n" +
      "/link <ваш_token>\n\n" +
      "Токен можно получить в LibreChat через команду /token",
  );
}

type LinkResponse = { sessionId?: string; hasStory?: boolean; token?: string };

async function performLinking(ctx: BotContext, token: string, telegramUserId: number): Promise<void> {
  try {
    const result = await callLinkTool(ctx, token, telegramUserId);
    saveSessionFromLinkResult(ctx, telegramUserId, result, token);
    await ctx.reply("✅ Аккаунты успешно привязаны! Теперь вы можете использовать бота.");
  } catch (error) {
    await handleLinkError(ctx, error);
  }
}

async function callLinkTool(ctx: BotContext, token: string, telegramUserId: number): Promise<LinkResponse | null> {
  const result = await callTool(ctx, "link_telegram", {
    token,
    telegramUserId,
    telegramUsername: ctx.from?.username,
    telegramFirstName: ctx.from?.first_name,
  });

  return parseJsonContent<LinkResponse>(result);
}

function saveSessionFromLinkResult(
  ctx: BotContext,
  telegramUserId: number,
  data: LinkResponse | null,
  token: string,
): void {
  if (!data?.sessionId) return;

  ctx.sessions.set(telegramUserId, {
    sessionId: data.sessionId,
    hasStory: data.hasStory ?? false,
    token: data.token ?? token,
  });
}

async function handleLinkError(ctx: BotContext, error: unknown): Promise<void> {
  if (error instanceof Error && error.message.includes("already linked")) {
    await ctx.reply("❌ Этот Telegram аккаунт уже привязан к другому пользователю");
    return;
  }
  throw error;
}
