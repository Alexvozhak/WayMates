import { HumanMessage } from "@langchain/core/messages";

import { contextCorrectionPrompt } from "#prompts/cold-start.js";

import { userContextSchema } from "../../../../shared/schemas.js";
import { AgentInvariantError } from "../../../errors.js";
import { logger } from "../../../logger.js";
import { contextCorrectionModel } from "../../shared-tools/extraction-models.js";
import { NODE, PHASE } from "../types.js";
import { withLogging } from "../with-logging.js";

import type { CoreClient } from "../../../core-client.js";
import type { ColdStartStateType, UserContext } from "../state.js";
import type { NormalizationEntry, StrictNormalizationField } from "../types.js";

function replaceContext(contexts: UserContext[], updated: UserContext): UserContext[] {
  return contexts.map((ctx) => (ctx.contextId === updated.contextId ? updated : ctx));
}

function getContextFieldValue(context: UserContext, field: StrictNormalizationField): string | undefined {
  if (field === "domain") {
    return context.domains[0];
  }
  return context[field];
}

async function addRevertedTerms(
  oldContext: UserContext,
  newContext: UserContext,
  normalizations: NormalizationEntry[],
  userId: string,
  coreClient: CoreClient,
): Promise<void> {
  for (const norm of normalizations) {
    const newValue = getContextFieldValue(newContext, norm.field);

    if (newValue === norm.original) {
      await coreClient.client.dictionaries.addTerm.mutate({
        type: norm.field,
        canonicalName: norm.original,
        complexity: null,
        verified: false,
        createdBy: userId,
      });
      logger.info({ field: norm.field, term: norm.original }, "[editContextNode] Added reverted term");
    }
  }
}

export const editContextNode = withLogging<ColdStartStateType>(
  NODE.edit_context,
  async (state, _config, { coreClient, normalizerService }) => {
    const { collectedContexts, parsedDecision, currentContextIndex, normalizations, userId } = state;

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

    const corrections = state.userResponse;
    const existingContext = currentContext;

    const prompt = contextCorrectionPrompt(existingContext, corrections);
    const { reasoning, ...extractedCorrections } = await contextCorrectionModel.invoke([new HumanMessage(prompt)]);
    logger.info({ reasoning }, "context correction reasoning");

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

    const normalizedContext = await normalizerService.normalizeFullContext(parseResult.data, userId);

    await addRevertedTerms(existingContext, normalizedContext, normalizations, userId, coreClient);

    const updatedContexts = replaceContext(collectedContexts, normalizedContext);

    return {
      collectedContexts: updatedContexts,
      phase: PHASE.awaiting_context_confirmation,
      normalizations: [],
    };
  },
);
