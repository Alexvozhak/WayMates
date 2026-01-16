import { errorCodeSchema } from "#private/schemas.js";

import type { ErrorCode } from "#private/schemas.js";

export const ERROR_CODES = errorCodeSchema.Values;

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
  constructor(
    message: string,
    public readonly code: ErrorCode | null,
    public readonly details: Record<string, unknown> | null,
    cause?: Error,
  ) {
    super(message, cause);
  }
}

export class WhisperError extends BotError {}

export class SessionError extends BotError {}
