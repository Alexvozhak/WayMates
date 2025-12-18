/**
 * Creates a route map from a list of node names.
 * LangGraph's addConditionalEdges requires { destinationName: destinationName } mapping.
 */
/* eslint-disable @typescript-eslint/consistent-type-assertions -- LangGraph route map pattern requires cast */
export function buildRouteMap<T extends string>(destinations: readonly T[]): Record<T, T> {
  const entries = destinations.map((d) => [d, d] as const);
  return Object.fromEntries(entries) as Record<T, T>;
}
/* eslint-enable @typescript-eslint/consistent-type-assertions */
