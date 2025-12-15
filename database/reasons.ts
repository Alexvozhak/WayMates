import reasonsData from "./reasons.json" with { type: "json" };

function assertNonEmptyArray<T>(arr: T[], message: string): asserts arr is [T, ...T[]] {
  if (arr.length === 0) {
    throw new Error(message);
  }
}

const reasonCanonicalNames = Object.keys(reasonsData);
assertNonEmptyArray(reasonCanonicalNames, "reasons.json must have at least one reason");

export const REASON_CANONICAL_NAMES = reasonCanonicalNames;
export type ReasonCanonicalName = keyof typeof reasonsData;
