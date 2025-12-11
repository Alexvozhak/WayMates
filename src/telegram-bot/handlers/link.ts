import type { BotContext } from "../types.js";

export async function handleLink(ctx: BotContext): Promise<void> {
  const token = ctx.message?.text?.replace("/link", "").trim();

  if (!token) {
    await showLinkUsage(ctx);
    return;
  }

  const telegramUserId = ctx.from?.id;
  if (!telegramUserId) {
    await ctx.reply(ctx.t("link-no-telegram-id"));
    return;
  }

  await performLinking(ctx, token, telegramUserId);
}

async function showLinkUsage(ctx: BotContext): Promise<void> {
  await ctx.reply(ctx.t("link-usage"));
}

async function performLinking(ctx: BotContext, token: string, telegramUserId: number): Promise<void> {
  try {
    const result = await ctx.services.mcpClient.callTool("link_telegram", { token, telegramUserId });

    ctx.session = {
      status: "initialised",
      token: result.token,
      hasStory: result.hasStory,
    };

    await ctx.services.sessionService.saveSessionId(telegramUserId, result.sessionId);

    await ctx.reply(ctx.t("link-success"));
  } catch (error) {
    await handleLinkError(ctx, error);
  }
}

async function handleLinkError(ctx: BotContext, error: unknown): Promise<void> {
  if (error instanceof Error && error.message.includes("already linked")) {
    await ctx.reply(ctx.t("link-already-exists"));
    return;
  }
  throw error;
}
