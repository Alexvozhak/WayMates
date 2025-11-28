import { z } from "zod";

export const sessionIdSchema = z
  .string()
  .regex(/^sess_[0-9a-f]{32}$/, "Session ID must be in format sess_<32-char-hex>")
  .describe("Session ID in format sess_<32-char-hex>");

export type SessionId = z.infer<typeof sessionIdSchema>;

export const errorCodeSchema = z.enum([
  "session_expired",
  "session_invalid",
  "normalization_failed",
  "core_api_error",
  "validation_error",
  "internal_error",
  "postgres_connection_failed",
  "postgres_query_failed",
]);

export type ErrorCode = z.infer<typeof errorCodeSchema>;

export const errorResponseSchema = z.object({
  code: errorCodeSchema,
  message: z.string(),
  details: z.record(z.unknown()).optional(),
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>;

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}
