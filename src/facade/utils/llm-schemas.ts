import { z } from "zod";

import type { ZodTypeAny } from "zod";

/**
 * Makes a single field nullable.
 * - Already nullable → return as-is
 * - Optional → unwrap and make nullable
 * - Otherwise → make nullable
 */
function toNullable(field: ZodTypeAny): z.ZodNullable<ZodTypeAny> {
  if (field instanceof z.ZodNullable) {
    return field;
  }
  if (field instanceof z.ZodOptional) {
    return field.unwrap().nullable();
  }
  return field.nullable();
}

/**
 * Transforms a Zod object schema making all top-level fields nullable.
 *
 * Used for LLM extraction schemas where all fields can be null
 * (LLM returns null for fields it couldn't extract).
 *
 * Example:
 *   const base = z.object({ name: z.string(), age: z.number() });
 *   const nullable = makeNullable(base);
 *   // → { name: string | null, age: number | null }
 */
export function makeNullable<T extends z.ZodObject<z.ZodRawShape>>(schema: T): z.ZodObject<z.ZodRawShape> {
  /* eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Zod shape is Record<string, ZodTypeAny> at runtime */
  const shape = schema.shape as Record<string, ZodTypeAny>;
  const newShape: Record<string, z.ZodNullable<ZodTypeAny>> = {};

  for (const [key, value] of Object.entries(shape)) {
    newShape[key] = toNullable(value);
  }

  return z.object(newShape);
}
