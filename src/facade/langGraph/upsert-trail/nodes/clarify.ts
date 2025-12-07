import { HumanMessage } from "@langchain/core/messages";
import { interrupt } from "@langchain/langgraph";

import { PHASE } from "../state.js";

import type { UpsertTrailStateType } from "../state.js";

export function clarifyNode(state: UpsertTrailStateType): Partial<UpsertTrailStateType> {
  const { missingFields } = state;

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
    phase: PHASE.awaitingClarification,
  });

  const response = String(userResponse);

  return {
    userResponse: response,
    messages: [new HumanMessage(response)],
    phase: PHASE.awaitingClarification,
  };
}
