import { formatSearchResult } from "../formatters/search.js";
import { callTool } from "../services/mcp-client.js";
import { parseSearchQuery } from "../services/nlp-parser.js";
import { setPendingAction } from "../services/pending-actions.js";

import type { BotContext } from "../types.js";

export async function handleSearch(ctx: BotContext): Promise<void> {
  const query = ctx.message?.text?.replace("/search", "").trim();
  await processSearchQuery(ctx, query);
}

export async function handleSearchWithText(ctx: BotContext, text: string): Promise<void> {
  await processSearchQuery(ctx, text);
}

async function processSearchQuery(ctx: BotContext, query: string | undefined): Promise<void> {
  if (!query) {
    await showSearchUsage(ctx);
    return;
  }

  await performSearch(ctx, query);
}

async function showSearchUsage(ctx: BotContext): Promise<void> {
  setPendingAction(ctx, "search");
  await ctx.reply(
    "🔍 Поиск карьерных путей\n\n" +
      "Использование:\n" +
      "/search <описание позиции>\n\n" +
      "Примеры:\n" +
      "/search Senior ML Engineer в Google\n" +
      "/search Backend разработчик Python удалёнка\n" +
      "/search Tech Lead стартап Москва\n\n" +
      "💬 Вы можете отправить текст или голосовое сообщение.",
  );
}

async function performSearch(ctx: BotContext, query: string): Promise<void> {
  await ctx.reply("🔍 Анализирую запрос и ищу подходящие карьерные пути...");
  await ctx.replyWithChatAction("typing");

  const searchParams = await parseSearchQuery(ctx.services.openaiApiKey, query);

  const result = await callTool(ctx, "search_by_target", {
    targetContext: {
      position: searchParams.position,
      organization: searchParams.organization ?? "",
      location: searchParams.location ?? "",
      domain: searchParams.domain ?? "",
      skills: searchParams.skills,
    },
    limit: 10,
  });

  const formattedResult = await formatSearchResult({
    apiKey: ctx.services.openaiApiKey,
    llmConfig: ctx.services.formatterLlm,
    languageCode: ctx.from?.language_code ?? "ru",
    result,
  });

  await ctx.reply(formattedResult, { parse_mode: "Markdown" });
}
