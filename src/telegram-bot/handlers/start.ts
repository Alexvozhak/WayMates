import type { BotContext } from "../types.js";

export async function handleStart(ctx: BotContext): Promise<void> {
  if (ctx.session.status === "uninitialised") {
    await ctx.services.sessionService.initialize(ctx);
  }

  await ctx.reply(ctx.t("welcome"));
}
