import { afterEach, beforeEach, describe, expect, test } from "vitest";
import type { Driver, Session } from "neo4j-driver";
import { join } from "path";
import {
  setupIntegrationTest,
  teardownIntegrationTest,
} from "../../helpers/database-setup.js";
import { executeUpsertStory } from "../../../src/upsert-story.js";
import { loadTestData } from "../../helpers/test-data-loader.js";
import { PresetsManager } from "../../../src/orcestrator/preset-manager.js";
import { QueryOrchestrator } from "../../../src/orcestrator/query-orchestrator.js";
import { Processors } from "../../../src/cypher/api.js";
import {
  DEFAULT_SEARCH_CONSTRAINTS,
} from "../../../src/unified-search-types.js";
import {
  DEFAULT_STRICT_SKILL_CATEGORIES,
} from "../../../src/schemas-zod.js";
import { getStrictSkills } from "../../../src/search-modes/helpers.js";

const PRESETS_PATH = join(process.cwd(), "config", "presets.json");

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
    const seedUsers = [
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

    const referenceStory = seedUsers[0];
    const currentContext = referenceStory.contexts[0];
    const targetContext = referenceStory.contexts[referenceStory.contexts.length - 1];

    const presetsManager = new PresetsManager(PRESETS_PATH);
    presetsManager.load();
    const orchestrator = new QueryOrchestrator(presetsManager, driver);

    const currentStage = await orchestrator.generateCurrentContextQuery(
      "FLEXIBLE",
      currentContext
    );
    const targetStage = await orchestrator.generateTargetContextQuery("FLEXIBLE");

    const cypher = [
      currentStage,
      targetStage,
      Processors.COMPATIBILITY_SCORE,
      `RETURN targetContext.context_id AS contextId,
              dbCurrentUser.user_id AS userId,
              targetContextCompatibilityScore AS targetScore,
              currentContextCompatibilityScore AS currentScore
      ORDER BY targetScore DESC, currentScore DESC
      LIMIT 5`,
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
    const [topRecord] = result.records;
    const targetScore = Number(topRecord!.get("targetScore"));
    const currentScore = Number(topRecord!.get("currentScore"));
    expect(targetScore).toBeGreaterThan(0);
    expect(currentScore).toBeGreaterThan(0);
  });
});
