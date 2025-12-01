import type { Command } from "@langchain/langgraph";

export type PhaseGuardFn<P extends string> = (
  currentPhase: P | undefined,
  expectedPhase: P | P[],
  toolCallId: string,
) => Command | null;

export type ConfirmationInterrupt = {
  type: "confirmation";
  message: string;
  data: unknown;
};

export type ClarificationInterrupt = {
  type: "clarification";
  missingFields: string[];
  questions: { field: string; question: string }[];
};
