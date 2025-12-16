import type { BotContext } from "../types.js";

/**
 * Classifies operations as heavy (rate limited) or light (not rate limited).
 *
 * After Phase 4 refactoring:
 * - All text messages route through converse.tool (heavy operation)
 * - Voice messages require transcription + converse (heavy operation)
 * - Only /start and /token are light operations
 *
 * Heavy operations:
 * - All text messages (unified converse handler)
 * - Voice messages (transcription + processing)
 * - /link command (MCP call)
 *
 * Light operations:
 * - /start command (welcome message)
 * - /token command (shows token from session)
 * - Callback queries (legacy, if any remain)
 */
export function isHeavyOperation(ctx: BotContext): boolean {
  const text = ctx.message?.text;

  // Light commands (no MCP or LLM)
  if (text) {
    const lightCommands = ["/start", "/token"];
    if (lightCommands.some((cmd) => text.startsWith(cmd))) {
      return false;
    }
  }

  // Voice messages (transcription + processing)
  if (ctx.message?.voice) {
    return true;
  }

  // All other text messages route through converse (heavy)
  if (text) {
    return true;
  }

  return false;
}
