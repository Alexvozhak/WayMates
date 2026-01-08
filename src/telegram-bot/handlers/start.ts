import { formatResponse } from "../presenters/format-response.js";

import type { BotContext } from "../types.js";

export async function handleStart(ctx: BotContext): Promise<void> {
  if (!ctx.userInfo || !ctx.from) {
    return;
  }

  // Clear cached message batcher to ensure fresh sessionId in process callback
  ctx.services.messageBatcher.clear(ctx.from.id);

  // Clear all active graph checkpoints to ensure clean state
  try {
    await ctx.services.mcpClient.callTool("cancel_all_graphs", {
      sessionId: ctx.userInfo.sessionId,
      requestId: ctx.requestId,
    });
  } catch {
    // Session may be fresh — nothing to cancel, continue
  }

  // Delegate to converse with greeting — FlowGuardChecker handles hasContext/hasGoal
  const languageCode = ctx.from.language_code;
  const converseResp = await ctx.services.mcpClient.callTool("converse", {
    sessionId: ctx.userInfo.sessionId,
    message: "hello",
    requestId: ctx.requestId,
    locale: languageCode,
  });

  const formatted = formatResponse(converseResp, languageCode);
  await ctx.reply(formatted, { parse_mode: "MarkdownV2" });
}
