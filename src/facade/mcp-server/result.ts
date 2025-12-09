import {
  errorCodeSchema as sharedErrorCodeSchema,
  errorResponseSchema as sharedErrorResponseSchema,
  sessionIdSchema as sharedSessionIdSchema,
} from "../../shared/schemas.js";

import type { z } from "zod";

// Backward compatibility aliases (will be removed in Phase 2)
export const sessionIdSchema = sharedSessionIdSchema;
export const errorCodeSchema = sharedErrorCodeSchema;
export const errorResponseSchema = sharedErrorResponseSchema;

export type SessionId = z.infer<typeof sessionIdSchema>;
export type ErrorCode = z.infer<typeof errorCodeSchema>;
export type ErrorResponse = z.infer<typeof errorResponseSchema>;

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}
