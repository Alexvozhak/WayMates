import { v7 as uuidv7 } from "uuid";

import { userIdSchema } from "../../shared/schemas.js";
import { InvalidTokenError } from "../errors.js";

import type { SessionService } from "./session.service.js";
import type { UserService } from "./user.service.js";
import type { UserId } from "../../shared/schemas.js";
import type { SessionId } from "../mcp-server/result.js";
import type { Token } from "../mcp-server/schemas.js";

export type RegisterResult = {
  token: Token;
  sessionId: SessionId;
  warning: string;
};

export type AuthenticateResult = {
  sessionId: SessionId;
};

export type TelegramRegisterResult = {
  userId: string;
  token: Token;
  sessionId: SessionId;
  isNewUser: boolean;
  hasStory: boolean;
};

export type TelegramLinkResult = {
  userId: string;
  sessionId: SessionId;
};

export type TelegramUserInfo = {
  telegramUserId: number;
};

export class AuthService {
  private static readonly registerWarning = "Save this token securely. It cannot be recovered if lost.";

  constructor(
    private readonly sessionService: SessionService,
    private readonly userService: UserService,
  ) {}

  async register(): Promise<RegisterResult> {
    const userId = this.generateUserId();
    const token = this.generateToken();

    await this.userService.create(userId, token);

    const sessionId = await this.sessionService.create(userId);

    return {
      token,
      sessionId,
      warning: AuthService.registerWarning,
    };
  }

  async authenticate(token: Token): Promise<AuthenticateResult> {
    const user = await this.userService.findByToken(token);

    if (!user) {
      throw new InvalidTokenError("Token not found or invalid");
    }

    const userId = userIdSchema.parse(user.userId);
    const sessionId = await this.sessionService.create(userId);
    await this.userService.updateLastAuthAt(userId);

    return { sessionId };
  }

  async registerViaTelegram(info: TelegramUserInfo): Promise<TelegramRegisterResult> {
    const existing = await this.userService.findByTelegramId(info.telegramUserId);

    if (existing) {
      const userId = userIdSchema.parse(existing.userId);
      const hasStory = await this.userService.isColdStartCompleted(userId);
      const sessionId = await this.sessionService.create(userId);
      await this.userService.updateLastAuthAt(userId);

      return {
        userId: existing.userId,
        token: existing.token,
        sessionId,
        isNewUser: false,
        hasStory,
      };
    }

    const userId = this.generateUserId();
    const token = this.generateToken();

    await this.userService.createTelegramUser(userId, token, info.telegramUserId);

    const sessionId = await this.sessionService.create(userId);

    return {
      userId,
      token,
      sessionId,
      isNewUser: true,
      hasStory: false,
    };
  }

  async linkTelegram(token: Token, info: TelegramUserInfo): Promise<TelegramLinkResult> {
    const user = await this.userService.findByToken(token);

    if (!user) {
      throw new InvalidTokenError("Token not found or invalid");
    }

    const existingTelegram = await this.userService.findByTelegramId(info.telegramUserId);
    if (existingTelegram) {
      if (existingTelegram.userId === user.userId) {
        const sessionId = await this.sessionService.create(userIdSchema.parse(user.userId));
        return { userId: user.userId, sessionId };
      }
      throw new InvalidTokenError("Telegram account already linked to another user");
    }

    await this.userService.linkTelegramToUser(user.userId, info.telegramUserId);

    const sessionId = await this.sessionService.create(userIdSchema.parse(user.userId));
    await this.userService.updateLastAuthAt(user.userId);

    return { userId: user.userId, sessionId };
  }

  private generateUserId(): UserId {
    return userIdSchema.parse(`usr_${uuidv7()}`);
  }

  private generateToken(): Token {
    return uuidv7();
  }
}
