import { setPendingAction } from "../services/pending-actions.js";

import type { BotContext, PendingAction } from "../types.js";

type LangGraphToolName = "update_context" | "upsert_context" | "upsert_trail";

export async function handleLangGraphApprove(ctx: BotContext, toolName: LangGraphToolName): Promise<void> {
  await ctx.answerCallbackQuery({ text: ctx.t("callback-processing") });
  if (ctx.callbackQuery?.message?.reply_markup) {
    await ctx.editMessageReplyMarkup();
  }

  const sessionId = await ctx.services.sessionService.getSessionId(ctx);
  const result = await ctx.services.mcpClient.callTool(toolName, {
    message: "да",
    sessionId,
  });

  if ("phase" in result && result.phase === "saved") {
    await ctx.editMessageText(ctx.t("langgraph-saved"));
    return;
  }

  const formattedMessage = await ctx.services.langGraphPresenter.format(result, ctx.from?.language_code);
  await ctx.editMessageText(formattedMessage, { parse_mode: "Markdown" });
}

export async function handleLangGraphEdit(ctx: BotContext, pendingAction: PendingAction): Promise<void> {
  await ctx.answerCallbackQuery();
  if (ctx.callbackQuery?.message?.reply_markup) {
    await ctx.editMessageReplyMarkup();
  }
  setPendingAction(ctx, pendingAction);
  await ctx.editMessageText(ctx.t("langgraph-edit-prompt"));
}

export async function handleLangGraphCancel(ctx: BotContext): Promise<void> {
  await ctx.answerCallbackQuery();
  if (ctx.callbackQuery?.message?.reply_markup) {
    await ctx.editMessageReplyMarkup();
  }
  await ctx.editMessageText(ctx.t("langgraph-cancelled"));
}

export async function handleUpdateContextApprove(ctx: BotContext): Promise<void> {
  await handleLangGraphApprove(ctx, "update_context");
}

export async function handleUpdateContextEdit(ctx: BotContext): Promise<void> {
  await handleLangGraphEdit(ctx, "update_context");
}

export async function handleUpdateContextCancel(ctx: BotContext): Promise<void> {
  await handleLangGraphCancel(ctx);
}

export async function handleUpsertContextApprove(ctx: BotContext): Promise<void> {
  await handleLangGraphApprove(ctx, "upsert_context");
}

export async function handleUpsertContextEdit(ctx: BotContext): Promise<void> {
  await handleLangGraphEdit(ctx, "add_context");
}

export async function handleUpsertContextCancel(ctx: BotContext): Promise<void> {
  await handleLangGraphCancel(ctx);
}

export async function handleUpsertTrailApprove(ctx: BotContext): Promise<void> {
  await handleLangGraphApprove(ctx, "upsert_trail");
}

export async function handleUpsertTrailEdit(ctx: BotContext): Promise<void> {
  await handleLangGraphEdit(ctx, "add_trail");
}

export async function handleUpsertTrailCancel(ctx: BotContext): Promise<void> {
  await handleLangGraphCancel(ctx);
}
