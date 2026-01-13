import { SessionError } from "../errors.js";

import type { UserInfo } from "../types.js";
import type { McpClient } from "./mcp-client.js";

export class SessionService {
  constructor(private mcpClient: McpClient) {}

  async getUserInfo(telegramUserId: number, requestId: string): Promise<UserInfo> {
    if (!telegramUserId) {
      throw new SessionError("Telegram user ID not found");
    }

    const result = await this.mcpClient.callTool("register_telegram", { telegramUserId, requestId });

    return {
      userId: result.userId,
      sessionId: result.sessionId,
      token: result.token,
    };
  }
}
