import reasonsData from "./reasons.json" with { type: "json" };

function assertNonEmptyArray<T>(arr: T[], message: string): asserts arr is [T, ...T[]] {
  if (arr.length === 0) {
    throw new Error(message);
  }
}

const reasonIds = Object.keys(reasonsData);
assertNonEmptyArray(reasonIds, "reasons.json must have at least one reason");

export const REASON_IDS = reasonIds;
export type ReasonId = keyof typeof reasonsData;
