import { afterEach, beforeEach, describe, expect, test } from "vitest";
import type { Driver, Session } from "neo4j-driver";
import { join } from "path";
import {
  setupIntegrationTest,
  teardownIntegrationTest,
} from "../../helpers/database-setup.js";
import { executeUpsertStory } from "../../../src/upsert-story.js";
import { loadTestData } from "../../helpers/test-data-loader.js";
import { PRESETS } from "../../../src/generated/presets.generated.js";
import { QueryOrchestrator } from "../../../src/orcestrator/query-orchestrator.js";
import { Processors } from "../../../src/cypher/api.js";
import { DEFAULT_SEARCH_CONSTRAINTS } from "../../../src/unified-search-types.js";
import {
  DEFAULT_STRICT_SKILL_CATEGORIES,
  StoryInput,
  UserContext,
} from "../../../src/schemas-zod.js";
import { getStrictSkills } from "../../../src/search-modes/helpers.js";

import { PRESETS_PATH } from "../../../src/config.js";

describe("Orchestrator functional workflow", () => {
  let driver: Driver;
  let session: Session;

  beforeEach(async () => {
    ({ driver, session } = await setupIntegrationTest());
  });

  afterEach(async () => {
    await teardownIntegrationTest(session, driver);
  });

  test("full current-to-target pipeline returns ranked target contexts", async () => {
    const seedUsers: StoryInput[] = [
      "USER_001",
      "USER_002",
      "USER_003",
      "USER_004",
      "USER_005",
      "USER_006",
    ].map((key) => loadTestData(key));

    for (const story of seedUsers) {
      await executeUpsertStory(driver, story);
    }

    const referenceStory: StoryInput = seedUsers[0]!;
    const currentContext: UserContext = referenceStory.contexts[0]!;
    const targetContext: UserContext =
      referenceStory.contexts[referenceStory.contexts.length - 1]!;

    const orchestrator = new QueryOrchestrator(PRESETS, driver);

    const currentStage = await orchestrator.generateCurrentContextQuery(
      "FLEXIBLE",
      currentContext
    );
    const targetStage = orchestrator.generateTargetContextQuery("FLEXIBLE");

    const cypher = [
      currentStage,
      targetStage,
      Processors.COMPATIBILITY_SCORE,
    ].join("\n\n");

    const params = {
      currentContext,
      targetContext,
      strictSkills: getStrictSkills(
        currentContext.skills,
        DEFAULT_STRICT_SKILL_CATEGORIES
      ),
      searchConstraints: DEFAULT_SEARCH_CONSTRAINTS,
    } as const;

    const result = await session.executeRead((tx) => tx.run(cypher, params));

    expect(result.records.length).toBeGreaterThan(0);
  });
});
