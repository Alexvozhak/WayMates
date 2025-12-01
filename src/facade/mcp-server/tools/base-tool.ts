import { ZodError } from "zod";

import { err, ok } from "../result.js";

import { FacadeError } from "./errors.js";

import type { AdhocUserContext, TargetContext, UserId } from "../../../shared/schemas.js";
import type { CoreTRPCClient } from "../../core-client/core-trpc-client.js";
import type { ErrorResponse, Result, SessionId } from "../result.js";

export type SessionMiddleware = {
  validate(sessionId: SessionId): Promise<UserId>;
};

export type Normalizer = {
  normalizeUserContext(context: AdhocUserContext, userId: UserId): Promise<AdhocUserContext>;
  normalizeTargetContext(context: TargetContext, userId: UserId): Promise<TargetContext>;
  normalizeSkill(skill: string, userId: UserId): Promise<string>;
};

export type WithSessionId = { sessionId: SessionId };

export abstract class BaseTool<TParams extends WithSessionId, TResult> {
  constructor(
    protected session: SessionMiddleware,
    protected normalizer: Normalizer,
    protected coreClient: CoreTRPCClient,
  ) {}

  async execute(params: TParams): Promise<Result<TResult, ErrorResponse>> {
    try {
      const userId = await this.session.validate(params.sessionId);
      const result = await this.executeImpl(params, userId);
      return ok(result);
    } catch (error) {
      return err(this.handleError(error));
    }
  }

  protected abstract executeImpl(params: TParams, userId: UserId): Promise<TResult>;

  private handleError(error: unknown): ErrorResponse {
    if (error instanceof FacadeError) {
      return error.toResponse();
    }

    if (error instanceof ZodError) {
      return {
        code: "validation_error",
        message: "Validation failed",
        details: { errors: error.errors },
      };
    }

    if (error instanceof Error) {
      return {
        code: "internal_error",
        message: "An unexpected error occurred.",
        details: { originalError: error.message },
      };
    }

    return {
      code: "internal_error",
      message: "An unexpected error occurred.",
    };
  }
}
