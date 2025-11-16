import { err, ok } from "../result.js";

import { FacadeError } from "./errors.js";

import type { UserId } from "../../shared/schemas.js";
import type { ErrorResponse, Result, SessionId } from "../result.js";

export type SessionMiddleware = {
  validate(sessionId: SessionId): Promise<UserId>;
};

export type Normalizer = {
  normalize(input: string): string | Promise<string>;
};

export type CoreRestClient = {
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body: unknown): Promise<T>;
  patch<T>(path: string, body: unknown): Promise<T>;
};

export abstract class BaseTool<TParams, TResult> {
  constructor(
    protected session: SessionMiddleware,
    protected normalizer: Normalizer,
    protected coreClient: CoreRestClient,
  ) {}

  async execute(params: TParams): Promise<Result<TResult, ErrorResponse>> {
    try {
      const sessionId = this.extractSessionId(params);
      const userId = await this.session.validate(sessionId);

      const result = await this.executeImpl(params, userId);

      return ok(result);
    } catch (error) {
      return err(this.handleError(error));
    }
  }

  protected abstract executeImpl(params: TParams, userId: UserId): Promise<TResult>;

  protected abstract extractSessionId(params: TParams): SessionId;

  private handleError(error: unknown): ErrorResponse {
    if (error instanceof FacadeError) {
      return error.toResponse();
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
