import { limit } from "@grammyjs/ratelimiter";

import type { BotContext } from "../types.js";
import type { Middleware } from "grammy";

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
function isHeavyOperation(ctx: BotContext): boolean {
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

/**
 * Creates Grammy rate limiter middleware for user spam protection.
 *
 * Configuration:
 * - timeFrame: Window duration in milliseconds (default: 10 seconds)
 * - limit: Max requests per window (default: 3 requests)
 *
 * Only rate limits heavy operations (commands that trigger MCP/LLM calls).
 * Light operations (callbacks, /start, /help) are not rate limited.
 */
export function createRateLimitMiddleware(windowMs: number, maxRequests: number): Middleware<BotContext> {
  return limit({
    timeFrame: windowMs,
    limit: maxRequests,

    // Only rate limit heavy operations
    keyGenerator: (ctx) => {
      if (!isHeavyOperation(ctx)) {
        return; // Skip rate limiting for light operations
      }
      if (!ctx.from?.id) {
        throw new Error("User ID not found for rate limiting");
      }
      return ctx.from.id.toString();
    },

    // Custom error message using i18n
    onLimitExceeded: (ctx) => {
      void ctx.reply(ctx.t("error-rate_limit"));
    },
  });
}
