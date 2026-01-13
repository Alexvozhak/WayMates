import { interrupt } from "@langchain/langgraph";

import { PHASE } from "../state.js";

import type { ColdStartStateType } from "../state.js";

export function showPlanNode(state: ColdStartStateType): Partial<ColdStartStateType> {
  const { queue } = state;

  const planPreview = queue.map((item, index) => {
    const trails = item.incomingTrails.length > 0 ? ` ← [${item.incomingTrails.join(", ")}]` : "";
    return `${index + 1}. ${item.preview}${trails}`;
  });

  const userResponse = interrupt({
    type: "plan_confirmation",
    message: "Your career timeline:",
    plan: planPreview,
    queue,
    options: ["approve", "edit", "cancel"],
    phase: PHASE.awaiting_plan_confirmation,
  });

  return {
    userResponse: String(userResponse),
    phase: PHASE.awaiting_plan_confirmation,
  };
}
