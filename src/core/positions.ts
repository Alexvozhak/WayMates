import positionsData from "../../database/positions.json" with { type: "json" };

export const POSITIONS = positionsData as Record<string, string>;

export type PositionId = Extract<keyof typeof positionsData, string>;

export function isPositionId(value: string): value is PositionId {
  return value in POSITIONS;
}

export function getPositionDisplayName(id: PositionId): string {
  return POSITIONS[id]!;
}
