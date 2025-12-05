import { callTool } from "../services/mcp-client.js";
import { parseJsonContent } from "../services/mcp-utils.js";
import { setPendingAction } from "../services/pending-actions.js";

import type { BotContext } from "../types.js";

export async function handleApproveCallback(ctx: BotContext): Promise<void> {
  await ctx.answerCallbackQuery();

  const result = await callTool(ctx, "cold_start", { message: "да" });
  const data = parseJsonContent<Record<string, unknown>>(result);

  if (data && data.phase === "COMPLETED" && typeof data.message === "string") {
    updateHasStory(ctx, true);
    await ctx.editMessageText(
      `✅ ${data.message}\n\n` +
        "Теперь вы можете:\n" +
        "• /search — Искать карьерные пути\n" +
        "• /story — Добавить ещё контекстов",
    );
    return;
  }

  await ctx.editMessageText("✅ Подтверждено");
}

export async function handleEditCallback(ctx: BotContext): Promise<void> {
  await ctx.answerCallbackQuery();
  setPendingAction(ctx, "story");
  await ctx.editMessageText("✏️ Введите изменения к вашей карьерной истории:");
}

export async function handleCancelCallback(ctx: BotContext): Promise<void> {
  await ctx.answerCallbackQuery();
  await callTool(ctx, "reset_cold_start", {});
  await ctx.editMessageText("❌ Сбор истории отменён. Начните заново с /story");
}

function updateHasStory(ctx: BotContext, hasStory: boolean): void {
  const telegramUserId = ctx.from?.id;
  if (!telegramUserId) return;

  const session = ctx.sessions.get(telegramUserId);
  if (!session) return;

  ctx.sessions.set(telegramUserId, { ...session, hasStory });
}
