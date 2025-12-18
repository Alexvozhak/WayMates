import { z } from "zod";

import type { StateSnapshot } from "@langchain/langgraph";

/**
 * Creates a typed interrupt phase extractor for a given phase schema.
 * Extracts the phase value from LangGraph StateSnapshot interrupt metadata.
 */
export function createInterruptPhaseExtractor<P extends string>(
  phaseSchema: z.ZodEnum<[P, ...P[]]>,
): (snapshot: StateSnapshot) => P | undefined {
  const schema = z.object({ phase: phaseSchema.optional() });

  return (snapshot) => {
    const task = snapshot.tasks[0];
    if (!task) return;

    const interrupt = task.interrupts[0];
    if (!interrupt) return;

    const parsed = schema.safeParse(interrupt.value);
    return parsed.success ? parsed.data.phase : undefined;
  };
}
