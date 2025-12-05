import { callTool } from "../services/mcp-client.js";

import type { BotContext } from "../types.js";

export async function handleCancel(ctx: BotContext): Promise<void> {
  try {
    await callTool(ctx, "reset_cold_start", {});

    await ctx.reply("❌ Операция отменена. Вы можете начать заново с /story");
  } catch (error) {
    if (error instanceof Error && error.message.includes("No active cold-start process")) {
      await ctx.reply("ℹ️ Нет активных операций для отмены");
      return;
    }
    throw error;
  }
}
