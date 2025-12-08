import { resetColdStartParamsSchema } from "../../facade/mcp-server/schemas.js";
import { coldStartResponseSchema } from "../schemas/mcp-responses.js";

import type { BotContext } from "../types.js";

export async function handleCancel(ctx: BotContext): Promise<void> {
  try {
    const sessionId = await ctx.services.sessionService.getSessionId(ctx);
    await ctx.services.mcpClient.callTool(
      "reset_cold_start",
      { sessionId },
      resetColdStartParamsSchema,
      coldStartResponseSchema,
    );

    await ctx.reply(ctx.t("cancel-success"));
  } catch (error) {
    if (error instanceof Error && error.message.includes("No active cold-start process")) {
      await ctx.reply(ctx.t("cancel-no-active"));
      return;
    }
    throw error;
  }
}
