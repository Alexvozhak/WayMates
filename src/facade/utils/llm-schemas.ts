import { z } from "zod";

import type { ZodTypeAny } from "zod";

function unwrapSchema(schema: ZodTypeAny): ZodTypeAny {
  if (schema instanceof z.ZodOptional) {
    return unwrapSchema(schema.unwrap());
  }
  if (schema instanceof z.ZodDefault) {
    return unwrapSchema(schema.removeDefault());
  }
  return schema;
}

function makeFieldNullable(schema: ZodTypeAny): z.ZodNullable<ZodTypeAny> {
  const unwrapped = unwrapSchema(schema);

  if (unwrapped instanceof z.ZodObject) {
    /* eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Zod shape is Record<string, ZodTypeAny> at runtime */
    const shape = unwrapped.shape as Record<string, ZodTypeAny>;
    const newShape: Record<string, z.ZodNullable<ZodTypeAny>> = {};

    for (const [key, value] of Object.entries(shape)) {
      newShape[key] = makeFieldNullable(value);
    }

    return z.object(newShape).nullable();
  }

  if (unwrapped instanceof z.ZodArray) {
    return unwrapped.nullable();
  }

  return unwrapped.nullable();
}

/**
 * Transforms a Zod object schema making all fields nullable at all levels.
 *
 * Used for OpenAI Structured Output which requires:
 * - Root type MUST be "object" (not nullable)
 * - All fields MUST be nullable (not optional)
 *
 * Handles: ZodObject (recursive), ZodArray, ZodEnum, primitives
 * Does NOT handle: ZodUnion, ZodIntersection, ZodEffects
 */
export function makeNullable<T extends z.ZodObject<z.ZodRawShape>>(schema: T): z.ZodObject<z.ZodRawShape> {
  const unwrapped = unwrapSchema(schema);

  if (!(unwrapped instanceof z.ZodObject)) {
    throw new TypeError("makeNullable requires a ZodObject schema at root level");
  }

  /* eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Zod shape is Record<string, ZodTypeAny> at runtime */
  const shape = unwrapped.shape as Record<string, ZodTypeAny>;
  const newShape: Record<string, z.ZodNullable<ZodTypeAny>> = {};

  for (const [key, value] of Object.entries(shape)) {
    newShape[key] = makeFieldNullable(value);
  }

  return z.object(newShape);
}
