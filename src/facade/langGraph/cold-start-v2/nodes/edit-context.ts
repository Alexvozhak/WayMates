import { HumanMessage } from "@langchain/core/messages";

import { userContextSchema } from "../../../../shared/schemas.js";
import { AgentInvariantError } from "../../../errors.js";
import { logger } from "../../../logger.js";
import { contextCorrectionModel } from "../../shared-tools/extraction-models.js";
import { contextCorrectionPrompt } from "../prompts.js";
import { PHASE } from "../state.js";

import type { ColdStartStateType, UserContext } from "../state.js";

function replaceContext(contexts: UserContext[], updated: UserContext): UserContext[] {
  return contexts.map((ctx) => (ctx.contextId === updated.contextId ? updated : ctx));
}

export async function editContextNode(state: ColdStartStateType): Promise<Partial<ColdStartStateType>> {
  const { collectedContexts, messages, parsedDecision, currentContextIndex } = state;

  const currentContext = collectedContexts[currentContextIndex];
  if (!currentContext) {
    throw new AgentInvariantError("editContextNode", "currentContext must exist", {
      currentContextIndex,
      collectedContextsLength: collectedContexts.length,
    });
  }

  if (!parsedDecision) {
    throw new AgentInvariantError("editContextNode", "parsedDecision must exist after parse node");
  }

  const corrections = parsedDecision.editInstructions;
  const existingContext = currentContext;

  const prompt = contextCorrectionPrompt(existingContext, corrections, messages);
  const extractedCorrections = await contextCorrectionModel.invoke([new HumanMessage(prompt)]);

  const mergedContext = {
    ...existingContext,
    ...extractedCorrections,
    contextId: existingContext.contextId,
    previousContextId: existingContext.previousContextId,
    nextContextId: existingContext.nextContextId,
    createdAt: existingContext.createdAt,
  };

  const parseResult = userContextSchema.safeParse(mergedContext);
  if (!parseResult.success) {
    logger.error({ zodErrors: parseResult.error.flatten() }, "[editContextNode] LLM returned invalid context");
    return { phase: PHASE.failed };
  }

  const updatedContexts = replaceContext(collectedContexts, parseResult.data);

  return {
    collectedContexts: updatedContexts,
    phase: PHASE.awaiting_context_confirmation,
  };
}
