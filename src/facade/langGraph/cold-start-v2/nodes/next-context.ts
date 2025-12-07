import type { ColdStartStateType } from "../state.js";

export function nextContextNode(state: ColdStartStateType): Partial<ColdStartStateType> {
  return {
    currentContextIndex: state.currentContextIndex + 1,
  };
}
