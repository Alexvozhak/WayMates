import { HumanMessage } from "@langchain/core/messages";
import { interrupt } from "@langchain/langgraph";

import { PHASE } from "../state.js";

import type { ColdStartStateType } from "../state.js";

export function gatherStoryNode(state: ColdStartStateType): Partial<ColdStartStateType> {
  if (state.userResponse && state.messages.length === 0) {
    return {
      messages: [new HumanMessage(state.userResponse)],
      phase: PHASE.story_gathering,
    };
  }

  const userResponse = interrupt({
    type: "story_gathering",
    phase: PHASE.story_gathering,
  });

  const response = String(userResponse);

  return {
    userResponse: response,
    messages: [new HumanMessage(response)],
    phase: PHASE.story_gathering,
  };
}
