import { searchUserCareersParamsSchema } from "../../facade/mcp-server/schemas.js";
import { searchResultResponseSchema } from "../schemas/mcp-responses.js";
import { parseCurrentQuery } from "../services/nlp-parser.js";
import { setPendingAction } from "../services/pending-actions.js";

import type { BotContext } from "../types.js";

export async function handleByCurrent(ctx: BotContext): Promise<void> {
  const query = ctx.message?.text?.replace("/by_current", "").trim();

  if (!query) {
    await showCurrentUsage(ctx);
    return;
  }

  await processCurrentQuery(ctx, query);
}

export async function processCurrentQuery(ctx: BotContext, query: string): Promise<void> {
  const statusMsg = await ctx.reply(ctx.t("searching-current"));
  await ctx.replyWithChatAction("typing");

  const searchParams = await parseCurrentQuery(ctx.services.openaiApiKey, query);
  const sessionId = await ctx.services.sessionService.getSessionId(ctx);

  const result = await ctx.services.mcpClient.callTool(
    "search_user_careers",
    { ...searchParams, sessionId },
    searchUserCareersParamsSchema,
    searchResultResponseSchema,
  );

  await ctx.api.deleteMessage(statusMsg.chat.id, statusMsg.message_id);

  const formattedText = await ctx.services.searchPresenter.formatSearchResult(
    JSON.stringify(result),
    ctx.from?.language_code ?? "ru",
  );

  await ctx.reply(formattedText, { parse_mode: "Markdown" });
}

async function showCurrentUsage(ctx: BotContext): Promise<void> {
  setPendingAction(ctx, "by_current");
  await ctx.reply(ctx.t("current-usage"));
}
