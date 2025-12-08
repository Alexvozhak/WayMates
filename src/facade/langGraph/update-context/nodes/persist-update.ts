import { AgentInvariantError } from "../../../errors.js";
import { hasConfigDeps } from "../../shared/types.js";
import { PHASE } from "../state.js";

import type { UpdateContextStateType } from "../state.js";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";

export async function persistUpdateNode(
  state: UpdateContextStateType,
  config: LangGraphRunnableConfig,
): Promise<Partial<UpdateContextStateType>> {
  const { mergedContext, userId } = state;

  if (!mergedContext) {
    return { phase: PHASE.failed };
  }

  if (!hasConfigDeps(config)) {
    throw new AgentInvariantError("persistUpdateNode", "Missing coreClient or normalizer");
  }
  const { coreClient, normalizer } = config.configurable;

  const normalized = await normalizer.normalizeFullContext(mergedContext, userId);

  await coreClient.client.context.update.mutate({ userId, updates: normalized });

  return { phase: PHASE.saved };
}
