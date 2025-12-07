import { AgentInvariantError } from "../../../errors.js";
import { hasConfigDeps } from "../../shared/types.js";
import { PHASE } from "../state.js";

import type { UpsertTrailStateType } from "../state.js";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";

export async function persistTrailNode(
  state: UpsertTrailStateType,
  config: LangGraphRunnableConfig,
): Promise<Partial<UpsertTrailStateType>> {
  const { validatedTrail, userId } = state;

  if (!validatedTrail) {
    return { phase: PHASE.failed };
  }

  if (!hasConfigDeps(config)) {
    throw new AgentInvariantError("persistTrailNode", "Missing coreClient or normalizer");
  }
  const { coreClient, normalizer } = config.configurable;

  const [normalizedSkill, normalizedPlatform] = await Promise.all([
    normalizer.normalizeSkill(validatedTrail.skill, userId),
    normalizer.normalizePlatform(validatedTrail.platform, userId),
  ]);

  await coreClient.client.trail.upsert.mutate({
    userId,
    trail: { ...validatedTrail, skill: normalizedSkill, platform: normalizedPlatform },
  });

  return { phase: PHASE.saved };
}
