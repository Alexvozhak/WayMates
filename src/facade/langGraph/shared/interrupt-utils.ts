import { z } from "zod";

import type { StateSnapshot } from "@langchain/langgraph";

/**
 * Creates a typed interrupt phase extractor for a given phase schema.
 * Extracts the phase value from LangGraph StateSnapshot interrupt metadata.
 */
export function createInterruptPhaseExtractor<P extends string>(
  phaseSchema: z.ZodEnum<[P, ...P[]]>,
): (snapshot: StateSnapshot) => P | null {
  const schema = z.object({ phase: phaseSchema.nullable() });

  return (snapshot) => {
    const task = snapshot.tasks[0];
    if (!task) return null;

    const interrupt = task.interrupts[0];
    if (!interrupt) return null;

    const parsed = schema.safeParse(interrupt.value);
    return parsed.success ? (parsed.data.phase ?? null) : null;
  };
}
