import { v7 as uuidv7 } from "uuid";

import { userIdSchema } from "../../../private/schemas.js";
import { InvalidTokenError } from "../errors.js";

import type { SessionService } from "./session.service.js";
import type { UserService } from "./user.service.js";
import type {
  SessionId,
  TelegramLinkResponse,
  TelegramRegisterResponse,
  Token,
  UserId,
} from "../../../private/schemas.js";

export type RegisterResult = {
  token: Token;
  sessionId: SessionId;
  warning: string;
};

export type AuthenticateResult = {
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

  async registerViaTelegram(info: TelegramUserInfo): Promise<TelegramRegisterResponse> {
    const existing = await this.userService.findByTelegramId(info.telegramUserId);

    if (existing) {
      const userId = userIdSchema.parse(existing.userId);
      const sessionId = await this.sessionService.getOrCreate(userId);
      await this.userService.updateLastAuthAt(userId);

      return {
        userId: existing.userId,
        token: null,
        sessionId,
        isNewUser: false,
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
    };
  }

  async linkTelegram(token: Token, info: TelegramUserInfo): Promise<TelegramLinkResponse> {
    const user = await this.userService.findByToken(token);

    if (!user) {
      throw new InvalidTokenError("Token not found or invalid");
    }

    const userId = userIdSchema.parse(user.userId);

    const existingTelegram = await this.userService.findByTelegramId(info.telegramUserId);
    if (existingTelegram) {
      if (existingTelegram.userId === user.userId) {
        const sessionId = await this.sessionService.create(userId);
        return { userId: user.userId, sessionId, token };
      }
      throw new InvalidTokenError("Telegram account already linked to another user");
    }

    await this.userService.linkTelegramToUser(user.userId, info.telegramUserId);

    const sessionId = await this.sessionService.create(userId);
    await this.userService.updateLastAuthAt(user.userId);

    return { userId: user.userId, sessionId, token };
  }

  private generateUserId(): UserId {
    return userIdSchema.parse(`usr_${uuidv7()}`);
  }

  private generateToken(): Token {
    return uuidv7();
  }
}
