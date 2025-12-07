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

  private generateUserId(): UserId {
    return userIdSchema.parse(`usr_${uuidv7()}`);
  }

  private generateToken(): Token {
    return uuidv7();
  }
}
