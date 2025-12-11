import type { BotContext } from "../types.js";

export async function handleDeleteGoal(ctx: BotContext): Promise<void> {
  const sessionId = await ctx.services.sessionService.getSessionId(ctx);

  const success = await ctx.services.mcpClient.callTool("delete_goal", {
    sessionId,
  });

  await (success ? ctx.reply(ctx.t("goal-deleted")) : ctx.reply(ctx.t("goal-not-set")));
}
