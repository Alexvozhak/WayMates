import { searchByTargetParamsSchema } from "../../facade/mcp-server/schemas.js";
import { searchResultResponseSchema } from "../schemas/mcp-responses.js";
import { parseTargetQuery } from "../services/nlp-parser.js";
import { setPendingAction } from "../services/pending-actions.js";

import type { BotContext } from "../types.js";

export async function handleByTarget(ctx: BotContext): Promise<void> {
  const query = ctx.message?.text?.replace("/by_target", "").trim();

  if (!query) {
    await showTargetUsage(ctx);
    return;
  }

  await processTargetQuery(ctx, query);
}

export async function processTargetQuery(ctx: BotContext, query: string): Promise<void> {
  const statusMsg = await ctx.reply(ctx.t("searching-target"));
  await ctx.replyWithChatAction("typing");

  const searchParams = await parseTargetQuery(ctx.services.openaiApiKey, query);
  const sessionId = await ctx.services.sessionService.getSessionId(ctx);

  const result = await ctx.services.mcpClient.callTool(
    "search_by_target",
    { ...searchParams, sessionId },
    searchByTargetParamsSchema,
    searchResultResponseSchema,
  );

  await ctx.api.deleteMessage(statusMsg.chat.id, statusMsg.message_id);

  const formattedText = await ctx.services.searchPresenter.format(result, ctx.from?.language_code);

  await ctx.reply(formattedText, { parse_mode: "Markdown" });
}

async function showTargetUsage(ctx: BotContext): Promise<void> {
  setPendingAction(ctx, "by_target");
  await ctx.reply(ctx.t("target-usage"));
}
