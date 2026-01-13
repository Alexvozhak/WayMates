import { formatResponse } from "../presenters/format-response.js";

import type { BotContext } from "../types.js";

/**
 * Unified handler for all user text messages.
 *
 * Flow:
 * 1. Get sessionId from userInfo (set by userInfoMiddleware)
 * 2. Enqueue message to batcher (combines rapid messages)
 * 3. If follower (batched) — skip reply
 * 4. Format ConverseResponse via LLM
 * 5. Reply to user
 *
 * Error handling: McpClientError is caught by global bot.catch()
 */
export async function handleConverse(ctx: BotContext): Promise<void> {
  const message = ctx.message?.text;
  if (!message || !ctx.from || !ctx.userInfo) {
    return;
  }

  const languageCode = ctx.from.language_code;

  const converseResp = await ctx.services.messageBatcher.enqueue(ctx.from.id, message, (combined) =>
    ctx.services.mcpClient.callTool("converse", {
      sessionId: ctx.userInfo!.sessionId,
      message: combined,
      requestId: ctx.requestId,
      locale: languageCode,
    }),
  );

  if (!converseResp) return;

  const formatted = formatResponse(converseResp, languageCode);

  await ctx.reply(formatted, { parse_mode: "MarkdownV2" });
}
