import { FacadeError } from "../../errors.js";
import { err, ok } from "../result.js";

import type { McpAuthParams } from "../../../../private/schemas.js";
import type { AuthenticateResult, AuthService, RegisterResult } from "../../services/auth.service.js";
import type { ErrorResponse, Result } from "../result.js";
import type { Logger } from "pino";

export type AuthResult = RegisterResult | AuthenticateResult;

export class AuthTool {
  constructor(
    private authService: AuthService,
    private logger: Logger,
  ) {}

  async execute(params: McpAuthParams): Promise<Result<AuthResult, ErrorResponse>> {
    const { requestId } = params;
    const start = Date.now();

    try {
      const result = params.token
        ? await this.authService.authenticate(params.token)
        : await this.authService.register();

      const durationMs = Date.now() - start;
      this.logger.info({ requestId, durationMs, tool: "AuthTool" }, "Auth completed");
      return ok(result);
    } catch (error) {
      const durationMs = Date.now() - start;
      this.logger.error({ requestId, durationMs, tool: "AuthTool", err: error }, "Auth failed");

      if (error instanceof FacadeError) {
        return err(error.toResponse());
      }
      throw error;
    }
  }
}
