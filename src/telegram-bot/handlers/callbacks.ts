import { coldStartParamsSchema, resetColdStartParamsSchema } from "../../facade/mcp-server/schemas.js";
import { coldStartResponseSchema } from "../schemas/mcp-responses.js";
import { setPendingAction } from "../services/pending-actions.js";

import type { BotContext } from "../types.js";

export async function handleApproveCallback(ctx: BotContext): Promise<void> {
  await ctx.answerCallbackQuery({ text: ctx.t("callback-processing") });

  const sessionId = await ctx.services.sessionService.getSessionId(ctx);
  const result = await ctx.services.mcpClient.callTool(
    "cold_start",
    { message: "да", sessionId },
    coldStartParamsSchema,
    coldStartResponseSchema,
  );

  if (result.phase === "saved") {
    // Story saved successfully → update session
    // Note: session.status guaranteed to be "initialised" by guard middleware
    if (ctx.session.status === "initialised") {
      ctx.session.hasStory = result.contexts.length > 0;
    }
    await ctx.editMessageText(ctx.t("story-approved", { message: ctx.t("story-saved-success") }));
    return;
  }

  // Other phases (awaiting_*, story_gathering) → show confirmation message
  await ctx.editMessageText(ctx.t("story-confirmed"));
}

export async function handleEditCallback(ctx: BotContext): Promise<void> {
  await ctx.answerCallbackQuery();
  setPendingAction(ctx, "story");
  await ctx.editMessageText(ctx.t("story-edit-prompt"));
}

export async function handleCancelCallback(ctx: BotContext): Promise<void> {
  await ctx.answerCallbackQuery();

  const sessionId = await ctx.services.sessionService.getSessionId(ctx);
  await ctx.services.mcpClient.callTool(
    "reset_cold_start",
    { sessionId },
    resetColdStartParamsSchema,
    coldStartResponseSchema,
  );

  await ctx.editMessageText(ctx.t("story-cancelled"));
}
