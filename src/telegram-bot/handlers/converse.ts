import { formatResponse } from "../presenters/format-response.js";

import type { BotContext } from "../types.js";

/**
 * Unified handler for all user text messages.
 * Replaces 14 command handlers + input-router.
 *
 * Flow:
 * 1. Get sessionId from session
 * 2. Call converse.tool with message
 * 3. Format ConverseResponse via LLM
 * 4. Reply to user
 *
 * Error handling: McpClientError is caught by global bot.catch()
 */
export async function handleConverse(ctx: BotContext): Promise<void> {
  const message = ctx.message?.text;
  if (!message) {
    return;
  }

  const sessionId = await ctx.services.sessionService.getSessionId(ctx);

  const converseResp = await ctx.services.mcpClient.callTool("converse", {
    sessionId,
    message,
  });

  const formatted = await formatResponse(converseResp, ctx.from?.language_code ?? "en", ctx.services);

  await ctx.reply(formatted, { parse_mode: "Markdown" });
}
