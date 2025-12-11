import { parseGoalQuery } from "../services/nlp-parser.js";
import { clearPendingAction, setPendingAction } from "../services/pending-actions.js";

import type { BotContext } from "../types.js";

export async function handleSetGoal(ctx: BotContext): Promise<void> {
  const query = ctx.message?.text?.replace("/goal set", "").trim();

  if (!query) {
    await showGoalUsage(ctx);
    return;
  }

  await processSetGoal(ctx, query);
}

export async function handleSetGoalWithText(ctx: BotContext, text: string): Promise<void> {
  await processSetGoal(ctx, text);
}

async function showGoalUsage(ctx: BotContext): Promise<void> {
  setPendingAction(ctx, "set_goal");
  await ctx.reply(ctx.t("goal-usage"));
}

async function processSetGoal(ctx: BotContext, query: string): Promise<void> {
  const statusMsg = await ctx.reply(ctx.t("parsing-goal"));
  await ctx.replyWithChatAction("typing");

  const targetContext = await parseGoalQuery(ctx.services.openaiApiKey, query);
  const sessionId = await ctx.services.sessionService.getSessionId(ctx);

  const result = await ctx.services.mcpClient.callTool("set_goal", {
    targetContext,
    sessionId,
  });

  await ctx.api.deleteMessage(statusMsg.chat.id, statusMsg.message_id);

  clearPendingAction(ctx);
  await ctx.reply(ctx.t("goal-set-success", { goalId: result.goalId }), { parse_mode: "Markdown" });
}
