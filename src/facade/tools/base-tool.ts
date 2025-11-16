import { err, ok } from '../../shared/result.js';

import type { ErrorResponse, Result, SessionId } from '../../shared/result.js';
import type { UserId } from '../../shared/schemas.js';


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

export class SessionExpiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SessionExpiredError';
  }
}

export class SessionInvalidError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SessionInvalidError';
  }
}

export class NormalizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NormalizationError';
  }
}

export class CoreApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CoreApiError';
  }
}

export abstract class BaseTool<TParams, TResult> {
  constructor(
    protected session: SessionMiddleware,
    protected normalizer: Normalizer,
    protected coreClient: CoreRestClient
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

  protected abstract executeImpl(
    params: TParams,
    userId: UserId
  ): Promise<TResult>;

  protected abstract extractSessionId(params: TParams): SessionId;

  private handleError(error: unknown): ErrorResponse {
    if (error instanceof SessionExpiredError) {
      return {
        code: 'session_expired',
        message: 'Session has expired. Please authenticate again.',
      };
    }

    if (error instanceof SessionInvalidError) {
      return {
        code: 'session_invalid',
        message: 'Invalid session ID.',
      };
    }

    if (error instanceof NormalizationError) {
      return {
        code: 'normalization_failed',
        message: error.message,
      };
    }

    if (error instanceof CoreApiError) {
      return {
        code: 'core_api_error',
        message: error.message,
      };
    }

    if (error instanceof Error) {
      return {
        code: 'internal_error',
        message: 'An unexpected error occurred.',
        details: { originalError: error.message },
      };
    }

    return {
      code: 'internal_error',
      message: 'An unexpected error occurred.',
    };
  }
}
