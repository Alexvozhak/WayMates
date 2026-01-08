import { BotError } from "../errors.js";

import type { BotContext } from "../types.js";

export async function handleLink(ctx: BotContext): Promise<void> {
  const token = ctx.message?.text?.replace("/link", "").trim();

  if (!token) {
    await ctx.reply(ctx.t("link-usage"));
    return;
  }

  const telegramUserId = ctx.from?.id;
  if (!telegramUserId) {
    throw new BotError("Telegram user ID not found");
  }

  try {
    await ctx.services.mcpClient.callTool("link_telegram", {
      token,
      telegramUserId,
      requestId: ctx.requestId,
    });

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
