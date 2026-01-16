import { ERROR_CODES, McpClientError, SessionError } from "../errors.js";

import type { BotContext, UserInfo } from "../types.js";
import type { McpClient } from "./mcp-client.js";

/**
 * Session management with in-memory cache.
 *
 * Flow:
 * 1. First message → cache miss → register_telegram → cache set
 * 2. Subsequent messages → cache hit → use cached sessionId
 * 3. session_expired → withRetry handles: invalidate → re-register → retry
 *
 * On bot restart cache is empty — will register on first message (rare, acceptable).
 */
export class SessionService {
  private cache = new Map<number, UserInfo>();

  constructor(private mcpClient: McpClient) {}

  async getUserInfo(telegramUserId: number, requestId: string): Promise<UserInfo> {
    if (!telegramUserId) {
      throw new SessionError("Telegram user ID not found");
    }

    const cached = this.cache.get(telegramUserId);
    if (cached) {
      return cached;
    }

    const result = await this.mcpClient.callTool("register_telegram", { telegramUserId, requestId });

    const userInfo: UserInfo = {
      userId: result.userId,
      sessionId: result.sessionId,
      token: result.token,
    };

    this.cache.set(telegramUserId, userInfo);
    return userInfo;
  }

  invalidate(telegramUserId: number): void {
    this.cache.delete(telegramUserId);
  }

  async withRetry<T>(ctx: BotContext, telegramUserId: number, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof McpClientError && error.code === ERROR_CODES.session_expired) {
        this.invalidate(telegramUserId);
        ctx.userInfo = await this.getUserInfo(telegramUserId, ctx.requestId);
        return fn();
      }
      throw error;
    }
  }
}
