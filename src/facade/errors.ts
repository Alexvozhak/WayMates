import type { ErrorResponse } from "./mcp-server/result.js";

/**
 * Base class for all Facade errors.
 *
 * Error Handling Strategy ("Dew Point" Rule):
 *
 * THROW FacadeError (or subclass) WHEN:
 * - Code bug or invariant violation
 * - Schema parse failed (unexpected data structure)
 * - Required field missing when should NEVER be missing
 * - PostgreSQL connection failed at startup
 * - State machine in impossible state
 * - contextIndex out of bounds (queue/index desync = bug)
 *
 * WHY: These errors indicate CRITICAL BUGS, not expected failures.
 * Production should NEVER reach these states. Need alerts + crash.
 *
 * RETURN graceful failure (Command.failed, error response) WHEN:
 * - LLM returned invalid output (can retry or ask user)
 * - User input unparseable (can ask clarification)
 * - External API timeout (can retry later)
 * - Max clarification rounds exceeded
 *
 * WHY: User can continue or retry. Agent stays operational.
 * Graceful degradation preserves workflow state.
 */
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
      details: null,
    };
  }

  protected getPublicMessage(): string {
    return this.message;
  }
}

export class SessionExpiredError extends FacadeError {
  override readonly errorCode = "session_expired";

  protected override getPublicMessage(): string {
    return "Session has expired. Please authenticate again.";
  }
}

export class InvalidTokenError extends FacadeError {
  override readonly errorCode = "invalid_token";

  protected override getPublicMessage(): string {
    return "Invalid or unknown token. Please register for a new account.";
  }
}

export class CoreApiError extends FacadeError {
  override readonly errorCode = "core_api_error";
}

export class InvalidStateError extends FacadeError {
  override readonly errorCode = "internal_error";

  constructor(phase: string, reason: string) {
    super(`Invalid state in phase ${phase}: ${reason}`);
  }
}

export class PostgresConnectionError extends FacadeError {
  override readonly errorCode = "postgres_connection_failed";

  constructor(originalError: unknown) {
    const message = originalError instanceof Error ? originalError.message : String(originalError);
    super(`PostgreSQL connection failed: ${message}`);
  }

  protected override getPublicMessage(): string {
    return "Database connection failed. Please try again later.";
  }
}

export class AgentInvariantError extends FacadeError {
  override readonly errorCode = "internal_error";

  constructor(tool: string, reason: string, context?: Record<string, unknown>) {
    const contextStr = context ? ` Context: ${JSON.stringify(context)}` : "";
    super(`[${tool}] Invariant violation: ${reason}.${contextStr}`);
  }
}

export class ToolExecutionError extends FacadeError {
  override readonly errorCode: ErrorResponse["code"];

  constructor(error: ErrorResponse) {
    super(error.message);
    this.errorCode = error.code;
  }
}

export class ValidationError extends FacadeError {
  override readonly errorCode = "validation_error";
}

export function throwToolError(error: ErrorResponse): never {
  throw new ToolExecutionError(error);
}

export class DocumentNotFoundError extends FacadeError {
  override readonly errorCode = "document_not_found";

  constructor(docType: string) {
    super(`Document "${docType}" not available`);
  }
}
