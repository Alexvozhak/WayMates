import { parseAdhocQuery } from "../services/nlp-parser.js";
import { setPendingAction } from "../services/pending-actions.js";

import type { BotContext } from "../types.js";

export async function handleByAdhoc(ctx: BotContext): Promise<void> {
  const query = ctx.message?.text?.replace("/by_adhoc", "").trim();

  if (!query) {
    await showAdhocUsage(ctx);
    return;
  }

  await processAdhocQuery(ctx, query);
}

export async function processAdhocQuery(ctx: BotContext, query: string): Promise<void> {
  const statusMsg = await ctx.reply(ctx.t("searching-adhoc"));
  await ctx.replyWithChatAction("typing");

  const searchParams = await parseAdhocQuery(ctx.services.openaiApiKey, query, ctx.services.openaiApiBase);
  const sessionId = await ctx.services.sessionService.getSessionId(ctx);

  const result = await ctx.services.mcpClient.callTool("search_careers", { ...searchParams, sessionId });

  await ctx.api.deleteMessage(statusMsg.chat.id, statusMsg.message_id);

  const formattedText = await ctx.services.searchPresenter.format(result, ctx.from?.language_code);

  await ctx.reply(formattedText, { parse_mode: "Markdown" });
}

async function showAdhocUsage(ctx: BotContext): Promise<void> {
  setPendingAction(ctx, "by_adhoc");
  await ctx.reply(ctx.t("adhoc-usage"));
}
