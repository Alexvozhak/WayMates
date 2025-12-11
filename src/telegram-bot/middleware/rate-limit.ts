import { limit } from "@grammyjs/ratelimiter";

import { isHeavyOperation } from "./rate-limit-utils.js";

import type { BotContext } from "../types.js";
import type { Middleware } from "grammy";

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
      return ctx.from?.id.toString() ?? "unknown";
    },

    // Custom error message using i18n
    onLimitExceeded: (ctx) => {
      void ctx.reply(ctx.t("error-rate_limit"));
    },
  });
}
