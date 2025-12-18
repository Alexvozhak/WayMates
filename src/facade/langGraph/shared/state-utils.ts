export const lastValue = <T>(_prev: T, next: T): T => next;

/**
 * StateUpdate<S> — semantic alias for Partial<S>.
 * Used as return type for LangGraph node functions to indicate state update intent.
 */
export type StateUpdate<S> = Partial<S>;
