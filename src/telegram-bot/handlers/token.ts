import type { BotContext } from "../types.js";

export async function handleToken(ctx: BotContext): Promise<void> {
  if (ctx.session.status === "uninitialised") {
    await ctx.reply(ctx.t("token-unavailable"));
    return;
  }

  await ctx.reply(ctx.t("token-display", { token: ctx.session.token }), { parse_mode: "Markdown" });
}
