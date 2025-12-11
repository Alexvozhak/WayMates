import type { BotContext } from "../types.js";

export async function handleDeleteTrail(ctx: BotContext): Promise<void> {
  const trailId = ctx.message?.text?.replace("/delete_trail", "").trim();

  if (!trailId) {
    await ctx.reply(ctx.t("delete-trail-usage"));
    return;
  }

  const sessionId = await ctx.services.sessionService.getSessionId(ctx);

  const success = await ctx.services.mcpClient.callTool("delete_trail", {
    trailId,
    sessionId,
  });

  await (success ? ctx.reply(ctx.t("trail-deleted")) : ctx.reply(ctx.t("trail-not-found")));
}
