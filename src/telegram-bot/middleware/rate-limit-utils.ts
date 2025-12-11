import type { BotContext } from "../types.js";

/**
 * Classifies operations as heavy (rate limited) or light (not rate limited).
 *
 * Heavy operations:
 * - Commands that invoke MCP tools or LLM processing
 * - Voice messages (transcription + processing)
 * - Text input with pending action (routes to LLM via input-router)
 *
 * Light operations:
 * - Simple commands (/start, /help, /token)
 * - Callback queries (inline keyboard buttons)
 */
export function isHeavyOperation(ctx: BotContext): boolean {
  const text = ctx.message?.text;

  // Heavy commands (invoke MCP tools or LLM)
  if (text) {
    const heavyCommands = [
      "/story",
      "/by_target",
      "/by_current",
      "/by_adhoc",
      "/link",
      "/cancel",
      "/context",
      "/trail",
      "/goal",
    ];

    if (heavyCommands.some((cmd) => text.startsWith(cmd))) {
      return true;
    }
  }

  // Voice messages (transcription + processing)
  if (ctx.message?.voice) {
    return true;
  }

  // Text with pending action (routes to LLM via input-router)
  if (ctx.session.status === "initialised" && ctx.session.pendingAction) {
    return true;
  }

  return false;
}
