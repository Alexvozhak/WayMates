import reasonsData from './reasons.json' with { type: "json" };

const reasonIds = Object.keys(reasonsData) as [string, ...string[]];

export const REASON_IDS = reasonIds;
export const REASONS_DATA = reasonsData;

export type ReasonId = keyof typeof reasonsData;
