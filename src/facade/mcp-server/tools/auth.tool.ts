import { FacadeError } from "../../errors.js";
import { err, ok } from "../result.js";

import type { McpAuthParams } from "../../../shared/schemas.js";
import type { AuthenticateResult, AuthService, RegisterResult } from "../../services/auth.service.js";
import type { ErrorResponse, Result } from "../result.js";

export type AuthResult = RegisterResult | AuthenticateResult;

export class AuthTool {
  constructor(private authService: AuthService) {}

  async execute(params: McpAuthParams): Promise<Result<AuthResult, ErrorResponse>> {
    try {
      if (params.token) {
        return ok(await this.authService.authenticate(params.token));
      }
      return ok(await this.authService.register());
    } catch (error) {
      if (error instanceof FacadeError) {
        return err(error.toResponse());
      }
      throw error;
    }
  }
}
