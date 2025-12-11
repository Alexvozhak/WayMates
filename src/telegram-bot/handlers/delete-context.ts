import type { BotContext } from "../types.js";

export async function handleDeleteContext(ctx: BotContext): Promise<void> {
  const contextId = ctx.message?.text?.replace("/delete_context", "").trim();

  if (!contextId) {
    await ctx.reply(ctx.t("delete-context-usage"));
    return;
  }

  const sessionId = await ctx.services.sessionService.getSessionId(ctx);

  const success = await ctx.services.mcpClient.callTool("delete_context", {
    contextId,
    sessionId,
  });

  await (success ? ctx.reply(ctx.t("context-deleted")) : ctx.reply(ctx.t("context-not-found")));
}
