import { ZodError } from "zod";

import { FacadeError } from "../../errors.js";
import { err, ok } from "../result.js";

import type { UserId } from "../../../shared/schemas.js";
import type { CoreClient } from "../../core-client.js";
import type { CheckpointService } from "../../services/checkpoint.service.js";
import type { Normalizer } from "../../services/normalizer.js";
import type { SessionService } from "../../services/session.service.js";
import type { UserService } from "../../services/user.service.js";
import type { ErrorResponse, Result, SessionId } from "../result.js";
import type { ZodType } from "zod";

export type WithSessionId = { sessionId: SessionId };

export type BaseToolDependencies = {
  session: SessionService;
  normalizer: Normalizer;
  coreClient: CoreClient;
  checkpointService: CheckpointService;
  userService: UserService;
};

export abstract class BaseTool<TParams extends WithSessionId, TResult> {
  protected session: SessionService;
  protected normalizer: Normalizer;
  protected coreClient: CoreClient;
  protected checkpointService: CheckpointService;
  protected userService: UserService;
  private paramsSchema: ZodType;

  constructor(deps: BaseToolDependencies, paramsSchema: ZodType) {
    this.session = deps.session;
    this.normalizer = deps.normalizer;
    this.coreClient = deps.coreClient;
    this.checkpointService = deps.checkpointService;
    this.userService = deps.userService;
    this.paramsSchema = paramsSchema;
  }

  async execute(params: TParams): Promise<Result<TResult, ErrorResponse>> {
    try {
      this.paramsSchema.parse(params);
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
