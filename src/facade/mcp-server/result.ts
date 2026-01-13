import { sessionIdSchema as sharedSessionIdSchema } from "../../../private/schemas.js";

import type { ErrorResponse as SharedErrorResponse, Result as SharedResult } from "../../../private/schemas.js";
import type { z } from "zod";

// Backward compatibility aliases (will be removed in Phase 2)
export const sessionIdSchema = sharedSessionIdSchema;

export type SessionId = z.infer<typeof sessionIdSchema>;
export type ErrorResponse = SharedErrorResponse;
export type Result<T, E> = SharedResult<T, E>;

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

export { errorCodeSchema, errorResponseSchema } from "../../../private/schemas.js";
