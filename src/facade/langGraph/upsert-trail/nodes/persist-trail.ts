import { PHASE } from "../state.js";
import { withLogging } from "../with-logging.js";

import type { UpsertTrailStateType } from "../state.js";

export const persistTrailNode = withLogging<UpsertTrailStateType>(
  "persist_trail",
  async (state, _config, { coreClient, normalizer }) => {
    const { validatedTrail, userId } = state;

    if (!validatedTrail) {
      return { phase: PHASE.failed };
    }

    const [normalizedSkill, normalizedPlatform] = await Promise.all([
      normalizer.normalizeSkill(validatedTrail.skill, userId),
      normalizer.normalizePlatform(validatedTrail.platform, userId),
    ]);

    await coreClient.client.trail.upsert.mutate({
      userId,
      trail: { ...validatedTrail, skill: normalizedSkill, platform: normalizedPlatform },
    });

    return { phase: PHASE.saved };
  },
);
