import type { BotContext, PendingAction } from "../types.js";

export function setPendingAction(ctx: BotContext, action: PendingAction): void {
  const telegramUserId = ctx.from?.id;
  if (telegramUserId) {
    ctx.pendingActions.set(telegramUserId, action);
  }
}

export function clearPendingAction(ctx: BotContext): void {
  const telegramUserId = ctx.from?.id;
  if (telegramUserId) {
    ctx.pendingActions.delete(telegramUserId);
  }
}

export function getPendingAction(ctx: BotContext): PendingAction | undefined {
  const telegramUserId = ctx.from?.id;
  return telegramUserId ? ctx.pendingActions.get(telegramUserId) : undefined;
}
