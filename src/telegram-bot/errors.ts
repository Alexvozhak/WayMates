import type { ErrorCode } from "../shared/schemas.js";

export class BotError extends Error {
  public override readonly cause?: Error;

  constructor(message: string, cause?: Error) {
    super(message);
    this.name = this.constructor.name;
    if (cause) {
      this.cause = cause;
    }
  }
}

export class McpClientError extends BotError {
  public readonly code?: ErrorCode;
  public readonly details?: Record<string, unknown>;

  constructor(message: string, cause?: Error);
  constructor(message: string, code: ErrorCode, details?: Record<string, unknown>);
  constructor(message: string, codeOrCause?: ErrorCode | Error, details?: Record<string, unknown>) {
    if (codeOrCause instanceof Error) {
      super(message, codeOrCause);
    } else {
      super(message);
      if (codeOrCause !== undefined) {
        this.code = codeOrCause;
      }
      if (details !== undefined) {
        this.details = details;
      }
    }
  }
}

export class WhisperError extends BotError {}

export class SessionError extends BotError {}
