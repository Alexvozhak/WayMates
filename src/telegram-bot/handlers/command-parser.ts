import type { BotContext } from "../types.js";

export function extractSubcommand(ctx: BotContext): string {
  const text = ctx.message?.text ?? "";
  const parts = text.trim().split(/\s+/);
  return parts[1] ?? "";
}
