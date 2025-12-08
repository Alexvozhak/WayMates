import type { BotContext } from "../types.js";

export async function handleHelp(ctx: BotContext): Promise<void> {
  await ctx.reply(ctx.t("help"));
}
