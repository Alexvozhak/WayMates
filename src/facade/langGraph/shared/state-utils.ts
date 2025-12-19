export const lastValue = <T>(_prev: T, next: T): T => next;

/**
 * StateUpdate<S> — semantic alias for Partial<S>.
 * Used as return type for LangGraph node functions to indicate state update intent.
 */
export type StateUpdate<S> = Partial<S>;

/**
 * Base graph state — minimum fields all graphs have.
 */
export type BaseGraphState = { phase: unknown; userId: unknown };

/**
 * Generic type guard for graph state. Checks object has `phase` and `userId`.
 * Use with type parameter for specific state type narrowing.
 */
export function isGraphState<T extends BaseGraphState>(values: unknown): values is T {
  if (!values || typeof values !== "object") return false;
  return "phase" in values && "userId" in values;
}
