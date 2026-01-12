import { FacadeTestContext } from "./test-context.js";

import type { SessionId } from "../../../../src/facade/mcp-server/result.js";
import type { BaseToolDependencies } from "../../../../src/facade/mcp-server/tools/base-tool.js";
import type { UserId } from "@shared/schemas.js";

export async function setupSession(userId: UserId): Promise<SessionId> {
  const ctx = FacadeTestContext.getInstance();

  const testToken = `test_token_${userId}`;
  await ctx.userService.ensureExists(userId, testToken);

  return ctx.sessionService.create(userId);
}

export async function cleanupSession(sessionId: SessionId): Promise<void> {
  const ctx = FacadeTestContext.getInstance();
  const sessionKey = `session:${sessionId}`;

  await ctx.redis.del(sessionKey);
}

export function getToolDeps(): BaseToolDependencies {
  const ctx = FacadeTestContext.getInstance();

  return {
    sessionService: ctx.sessionService,
    normalizerService: ctx.normalizerService,
    coreClient: ctx.coreClient,
    dictionariesService: ctx.dictionariesService,
    checkpointService: ctx.checkpointService,
    userService: ctx.userService,
    documentaryService: ctx.documentaryService,
    logger: ctx.logger,
  };
}
