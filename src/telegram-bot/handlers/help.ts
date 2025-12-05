import type { BotContext } from "../types.js";

export async function handleHelp(ctx: BotContext): Promise<void> {
  await ctx.reply(
    "📚 Справка по командам:\n\n" +
      "/start — Приветствие и регистрация\n" +
      "/story — Начать сбор карьерной истории\n" +
      "/search <описание> — Поиск карьерных путей\n" +
      "/link <token> — Привязать LibreChat аккаунт\n" +
      "/cancel — Отменить текущую операцию\n" +
      "/help — Эта справка\n\n" +
      "💡 Примеры использования:\n" +
      "/story\n" +
      "Работал backend разработчиком в Яндексе 3 года...\n\n" +
      "/search Senior ML Engineer в Google\n\n" +
      "Нужна помощь? Напишите @waymates_support",
  );
}
