import { ensureSession } from "../services/mcp-client.js";

import type { BotContext } from "../types.js";

export async function handleStart(ctx: BotContext): Promise<void> {
  await ensureSession(ctx);

  await ctx.reply(
    "👋 Добро пожаловать в WayMates!\n\n" +
      "Я помогу найти карьерные пути на основе опыта похожих специалистов.\n\n" +
      "Доступные команды:\n" +
      "/story — Начать сбор карьерной истории\n" +
      "/search — Поиск карьерных путей\n" +
      "/help — Справка по командам\n\n" +
      "Начнём с /story — расскажите о своём опыте!",
  );
}
