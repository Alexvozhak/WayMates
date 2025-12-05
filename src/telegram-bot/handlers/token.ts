import type { BotContext } from "../types.js";

export async function handleToken(ctx: BotContext): Promise<void> {
  const telegramUserId = ctx.from?.id;
  if (!telegramUserId) {
    return;
  }

  const session = ctx.sessions.get(telegramUserId);
  if (!session?.token) {
    await ctx.reply("⚠️ Токен недоступен. Используйте /start для регистрации.");
    return;
  }

  await ctx.reply(
    "🔑 Ваш токен для LibreChat:\n\n" +
      `\`${session.token}\`\n\n` +
      "Нажмите на токен чтобы скопировать.\n" +
      "Используйте его в LibreChat: /link <token>",
    { parse_mode: "Markdown" },
  );
}
