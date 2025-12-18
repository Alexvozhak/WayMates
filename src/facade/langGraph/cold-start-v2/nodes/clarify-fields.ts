import { HumanMessage } from "@langchain/core/messages";
import { interrupt } from "@langchain/langgraph";

import { AgentInvariantError } from "../../../errors.js";
import { PHASE } from "../state.js";

import type { ColdStartStateType } from "../state.js";

export function clarifyFieldsNode(state: ColdStartStateType): Partial<ColdStartStateType> {
  const { missingFields, currentEntityContext } = state;

  if (!currentEntityContext) {
    throw new AgentInvariantError("clarifyFieldsNode", "currentEntityContext must be set before clarification");
  }

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
    entity: currentEntityContext.preview,
    phase: PHASE.awaiting_clarification,
  });

  const response = String(userResponse);

  return {
    userResponse: response,
    messages: [new HumanMessage(response)],
    phase: PHASE.awaiting_clarification,
  };
}
