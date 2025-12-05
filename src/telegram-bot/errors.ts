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

export class SessionExpiredError extends BotError {
  constructor(message = "Session expired. Please start again with /start") {
    super(message);
  }
}

export class McpClientError extends BotError {}

export class WhisperError extends BotError {}

export class NlpParseError extends BotError {}
