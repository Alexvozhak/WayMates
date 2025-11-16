import type { ErrorResponse } from "../result.js";

export abstract class FacadeError extends Error {
  abstract readonly errorCode: ErrorResponse["code"];

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }

  toResponse(): ErrorResponse {
    return {
      code: this.errorCode,
      message: this.getPublicMessage(),
    };
  }

  protected getPublicMessage(): string {
    return this.message;
  }
}

export class SessionExpiredError extends FacadeError {
  readonly errorCode = "session_expired";

  protected getPublicMessage(): string {
    return "Session has expired. Please authenticate again.";
  }
}

export class SessionInvalidError extends FacadeError {
  readonly errorCode = "session_invalid";

  protected getPublicMessage(): string {
    return "Invalid session ID.";
  }
}

export class NormalizationError extends FacadeError {
  readonly errorCode = "normalization_failed";
}

export class CoreApiError extends FacadeError {
  readonly errorCode = "core_api_error";
}
