import { SessionError } from "../errors.js";
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
 * Session expiry: If session expired, silently re-register and retry.
 * User sees no error — seamless renewal.
 */
export async function handleConverse(ctx: BotContext): Promise<void> {
  const message = ctx.message?.text;
  if (!message || !ctx.from || !ctx.userInfo) {
    return;
  }

  const telegramUserId = ctx.from.id;
  const languageCode = ctx.from.language_code;

  await ctx.services.sessionService.withRetry(ctx, telegramUserId, async () => {
    const userInfo = ctx.userInfo;
    if (!userInfo) {
      throw new SessionError("userInfo lost during retry");
    }

    const resp = await ctx.services.messageBatcher.enqueue(telegramUserId, message, (combined) =>
      ctx.services.mcpClient.callTool("converse", {
        sessionId: userInfo.sessionId,
        message: combined,
        requestId: ctx.requestId,
        locale: languageCode,
      }),
    );

    if (!resp) return;

    await ctx.reply(formatResponse(resp, languageCode), { parse_mode: "MarkdownV2" });
  });
}
