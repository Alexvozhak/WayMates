import { HumanMessage } from "@langchain/core/messages";
import { interrupt } from "@langchain/langgraph";

import { PHASE } from "../state.js";

import type { UpsertContextStateType } from "../state.js";

export function clarifyNode(state: UpsertContextStateType): Partial<UpsertContextStateType> {
  const { missingFields, messages } = state;

  const questions = missingFields.map((mf) => ({
    field: mf.field,
    entityLabel: mf.entityLabel,
    entityType: mf.entityType,
    message: mf.zodMessage,
  }));

  const userResponse = interrupt({
    type: "clarification",
    message: "Please provide missing information:",
    questions,
    phase: PHASE.awaiting_clarification,
  });

  const response = String(userResponse);

  return {
    userResponse: response,
    messages: [...messages, new HumanMessage(response)],
    phase: PHASE.awaiting_clarification,
  };
}
