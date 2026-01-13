import { randomUUID } from "node:crypto";

import type { BotContext } from "../types.js";
import type { NextFunction } from "grammy";

// eslint-disable-next-line complexity
export async function timingMiddleware(ctx: BotContext, next: NextFunction): Promise<void> {
  ctx.requestId = randomUUID();
  const start = Date.now();

  // Log incoming message
  const incomingText = ctx.message?.text || ctx.message?.caption || (ctx.message?.document ? "[document]" : "[other]");
  ctx.services.logger.info(
    { requestId: ctx.requestId, telegramId: ctx.from?.id, direction: "IN", message: incomingText },
    "User message",
  );

  // Wrap reply to log outgoing messages
  const originalReply = ctx.reply.bind(ctx);
  // @ts-expect-error - simplified wrapper for logging
  ctx.reply = async (text: string, other?: unknown) => {
    ctx.services.logger.info(
      { requestId: ctx.requestId, telegramId: ctx.from?.id, direction: "OUT", message: text.slice(0, 500) },
      "Bot response",
    );
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return originalReply(text, other as Parameters<typeof originalReply>[1]);
  };

  await next();

  const durationMs = Date.now() - start;
  ctx.services.logger.info({ requestId: ctx.requestId, telegramId: ctx.from?.id, durationMs }, "Request completed");
}
