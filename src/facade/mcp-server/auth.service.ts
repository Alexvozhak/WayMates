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

  private generateUserId(): UserId {
    return userIdSchema.parse(`usr_${uuidv7()}`);
  }

  private generateToken(): Token {
    return uuidv7();
  }
}
