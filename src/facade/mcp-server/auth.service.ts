import { v7 as uuidv7 } from "uuid";

import { userIdSchema } from "../../shared/schemas.js";
import { InvalidTokenError } from "../errors.js";
import { postgresService } from "../infrastructure/postgres.service.js";

import type { SessionId } from "./result.js";
import type { Token } from "./schemas.js";
import type { SessionMiddleware } from "./session-middleware.js";
import type { UserId } from "../../shared/schemas.js";

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
  telegramUsername?: string | undefined;
  telegramFirstName?: string | undefined;
};

export class AuthService {
  private static readonly registerWarning = "Save this token securely. It cannot be recovered if lost.";

  constructor(private sessionMiddleware: SessionMiddleware) {}

  async register(): Promise<RegisterResult> {
    const userId = this.generateUserId();
    const token = this.generateToken();

    await postgresService.createUser(userId, token);

    const sessionId = await this.sessionMiddleware.createWithSingleActiveSession(userId);

    return {
      token,
      sessionId,
      warning: AuthService.registerWarning,
    };
  }

  async authenticate(token: Token): Promise<AuthenticateResult> {
    const user = await postgresService.findUserByToken(token);

    if (!user) {
      throw new InvalidTokenError("Token not found or invalid");
    }

    const userId = userIdSchema.parse(user.userId);
    const sessionId = await this.sessionMiddleware.createWithSingleActiveSession(userId);
    await postgresService.updateLastAuthAt(userId);

    return { sessionId };
  }

  async registerViaTelegram(info: TelegramUserInfo): Promise<TelegramRegisterResult> {
    const existing = await postgresService.findUserByTelegramId(info.telegramUserId);

    if (existing) {
      const userId = userIdSchema.parse(existing.userId);
      const hasStory = await postgresService.isColdStartCompleted(userId);
      const sessionId = await this.sessionMiddleware.createWithSingleActiveSession(userId);
      await postgresService.updateLastAuthAt(userId);

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

    await postgresService.createTelegramUser(
      userId,
      token,
      info.telegramUserId,
      info.telegramUsername,
      info.telegramFirstName,
    );

    const sessionId = await this.sessionMiddleware.createWithSingleActiveSession(userId);

    return {
      userId,
      token,
      sessionId,
      isNewUser: true,
      hasStory: false,
    };
  }

  async linkTelegram(token: Token, info: TelegramUserInfo): Promise<TelegramLinkResult> {
    const user = await postgresService.findUserByToken(token);

    if (!user) {
      throw new InvalidTokenError("Token not found or invalid");
    }

    const existingTelegram = await postgresService.findUserByTelegramId(info.telegramUserId);
    if (existingTelegram) {
      if (existingTelegram.userId === user.userId) {
        const sessionId = await this.sessionMiddleware.createWithSingleActiveSession(userIdSchema.parse(user.userId));
        return { userId: user.userId, sessionId };
      }
      throw new InvalidTokenError("Telegram account already linked to another user");
    }

    await postgresService.linkTelegramToUser(
      user.userId,
      info.telegramUserId,
      info.telegramUsername,
      info.telegramFirstName,
    );

    const sessionId = await this.sessionMiddleware.createWithSingleActiveSession(userIdSchema.parse(user.userId));
    await postgresService.updateLastAuthAt(user.userId);

    return { userId: user.userId, sessionId };
  }

  private generateUserId(): UserId {
    return userIdSchema.parse(`usr_${uuidv7()}`);
  }

  private generateToken(): Token {
    return uuidv7();
  }
}
