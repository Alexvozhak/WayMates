import { formatResponse } from "../presenters/format-response.js";

import type { BotContext } from "../types.js";

/**
 * Unified handler for all user text messages.
 *
 * Flow:
 * 1. Get sessionId from session
 * 2. Enqueue message to batcher (combines rapid messages)
 * 3. If follower (batched) — skip reply
 * 4. Format ConverseResponse via LLM
 * 5. Reply to user
 *
 * Error handling: McpClientError is caught by global bot.catch()
 */
export async function handleConverse(ctx: BotContext): Promise<void> {
  const message = ctx.message?.text;
  if (!message || !ctx.from) {
    return;
  }

  const sessionId = await ctx.services.sessionService.getSessionId(ctx);

  const locale = ctx.from.language_code === "ru" ? "ru" : "en";

  const converseResp = await ctx.services.messageBatcher.enqueue(ctx.from.id, message, (combined) =>
    ctx.services.mcpClient.callTool("converse", {
      sessionId,
      message: combined,
      requestId: ctx.requestId,
      locale,
    }),
  );

  if (!converseResp) return;

  const formatted = formatResponse(converseResp, ctx.from.language_code);

  await ctx.reply(formatted, { parse_mode: "MarkdownV2" });
}
