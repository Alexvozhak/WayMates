import type { BotContext, PendingAction } from "../types.js";

export function setPendingAction(ctx: BotContext, action: PendingAction): void {
  if (ctx.session.status === "uninitialised") return;
  ctx.session.pendingAction = action;
}

export function clearPendingAction(ctx: BotContext): void {
  if (ctx.session.status === "uninitialised") return;
  delete ctx.session.pendingAction;
}

export function getPendingAction(ctx: BotContext): PendingAction | undefined {
  if (ctx.session.status === "uninitialised") return undefined;
  return ctx.session.pendingAction;
}
