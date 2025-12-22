import * as Sentry from "@sentry/node";

import type { NodeEnv } from "./env/index.js";
import type { ServiceName } from "./logger.js";
import type { SessionId, UserId } from "./schemas.js";

export type SentryConfig = {
  dsn: string | null;
  environment: NodeEnv;
  service: ServiceName;
};

type TelegramTags = {
  telegramUserId: string;
  userId?: UserId;
  sessionId?: SessionId;
};

type FacadeTags = {
  tool: string;
  userId?: UserId;
  sessionId?: SessionId;
};

type CoreTags = { path: string };

export type SentryTags = TelegramTags | FacadeTags | CoreTags;

export function initSentry(config: SentryConfig): void {
  if (!config.dsn) {
    return;
  }

  Sentry.init({
    dsn: config.dsn,
    environment: config.environment,
    serverName: config.service,
    // 10% for MVP (50-200 users)
    // Free tier: 10K transactions/month
    // 200 users × 10 req/day × 30 days × 0.1 = 6K — fits free tier
    tracesSampleRate: 0.1,
  });
}

export function captureException(error: unknown, tags: SentryTags): void {
  Sentry.captureException(error, { tags });
}
