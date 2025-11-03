import reasonsData from "../../database/reasons.json" with { type: "json" };

export const REASONS = reasonsData as Record<string, string>;

export type ReasonId = Extract<keyof typeof reasonsData, string>;

export function isReasonId(value: string): value is ReasonId {
  return value in REASONS;
}

export function getReasonDescription(id: ReasonId): string {
  return REASONS[id]!;
}
