import { AgentInvariantError } from "../../../errors.js";
import { hasConfigDeps } from "../../shared/types.js";
import { PHASE } from "../state.js";

import type { UpsertContextStateType } from "../state.js";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";

export async function persistContextNode(
  state: UpsertContextStateType,
  config: LangGraphRunnableConfig,
): Promise<Partial<UpsertContextStateType>> {
  const { validatedContext, userId } = state;

  if (!validatedContext) {
    return { phase: PHASE.failed };
  }

  if (!hasConfigDeps(config)) {
    throw new AgentInvariantError("persistContextNode", "Missing coreClient or normalizer");
  }
  const { coreClient, normalizer } = config.configurable;

  const normalized = await normalizer.normalizeFullContext(validatedContext, userId);

  await coreClient.client.context.upsertContext.mutate({ userId, context: normalized });

  return { phase: PHASE.saved };
}
