import type { BotContext } from "../types.js";

export async function handleGetStory(ctx: BotContext): Promise<void> {
  const statusMsg = await ctx.reply(ctx.t("loading-story"));
  await ctx.replyWithChatAction("typing");

  const sessionId = await ctx.services.sessionService.getSessionId(ctx);

  const result = await ctx.services.mcpClient.callTool("get_story", {
    sessionId,
  });

  await ctx.api.deleteMessage(statusMsg.chat.id, statusMsg.message_id);

  const formattedText = await ctx.services.storyPresenter.format(result, ctx.from?.language_code);

  await ctx.reply(formattedText, { parse_mode: "Markdown" });
}
