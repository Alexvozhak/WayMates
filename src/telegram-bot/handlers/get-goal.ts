import type { BotContext } from "../types.js";

export async function handleGetGoal(ctx: BotContext): Promise<void> {
  const statusMsg = await ctx.reply(ctx.t("loading-goal"));
  await ctx.replyWithChatAction("typing");

  const sessionId = await ctx.services.sessionService.getSessionId(ctx);

  const result = await ctx.services.mcpClient.callTool("get_goal", {
    sessionId,
  });

  await ctx.api.deleteMessage(statusMsg.chat.id, statusMsg.message_id);

  if (!result) {
    await ctx.reply(ctx.t("goal-not-set"));
    return;
  }

  const formattedText = await ctx.services.goalPresenter.format(result, ctx.from?.language_code);

  await ctx.reply(formattedText, { parse_mode: "Markdown" });
}
