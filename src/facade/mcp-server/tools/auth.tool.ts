import { FacadeError } from "../../errors.js";
import { err, ok } from "../result.js";


import type { AuthenticateResult, AuthService, RegisterResult } from "../auth.service.js";
import type { ErrorResponse, Result } from "../result.js";
import type { AuthParams } from "../schemas.js";

export type AuthResult = RegisterResult | AuthenticateResult;

export class AuthTool {
  constructor(private authService: AuthService) {}

  async execute(params: AuthParams): Promise<Result<AuthResult, ErrorResponse>> {
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
