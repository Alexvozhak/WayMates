import { AgentInvariantError } from "../../errors.js";

import type { z } from "zod";

/**
 * Creates a typed state validator using Zod schema.
 * Replaces primitive type guards with full schema validation.
 */
export function createStateValidator<T>(schema: z.ZodType<T>, name: string): (values: unknown) => T {
  return (values) => {
    const result = schema.safeParse(values);
    if (!result.success) {
      throw new AgentInvariantError(`to${name}State`, result.error.message);
    }
    return result.data;
  };
}
