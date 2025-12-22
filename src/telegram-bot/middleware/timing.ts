import { randomUUID } from "node:crypto";

import type { BotContext } from "../types.js";
import type { NextFunction } from "grammy";

export async function timingMiddleware(ctx: BotContext, next: NextFunction): Promise<void> {
  ctx.requestId = randomUUID();
  const start = Date.now();

  await next();

  const durationMs = Date.now() - start;
  ctx.services.logger.info({ requestId: ctx.requestId, telegramId: ctx.from?.id, durationMs }, "Request completed");
}
