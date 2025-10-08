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
import {
  getOptimalFieldOrder,
  FALLBACK_SELECTIVITY,
} from "../../../src/orcestrator/selectivity-profiler.js";
import { buildExplainQuery } from "../../../src/orcestrator/snippets-extractor.js";

const PRESETS_PATH = join(process.cwd(), "config", "presets.json");

describe("QueryOrchestrator integration", () => {
  let driver: Driver;
  let session: Session;

  beforeEach(async () => {
    ({ driver, session } = await setupIntegrationTest());
  });

  afterEach(async () => {
    await teardownIntegrationTest(session, driver);
  });

  test("generateCurrentContextQuery produces compatible matches", async () => {
    const baseUser = loadTestData("USER_001");
    const comparisonUsers = ["USER_002", "USER_003", "USER_004"].map((key) =>
      loadTestData(key)
    );

    await executeUpsertStory(driver, baseUser);
    for (const story of comparisonUsers) {
      await executeUpsertStory(driver, story);
    }

    const manager = new PresetsManager(PRESETS_PATH);
    manager.load();
    const orchestrator = new QueryOrchestrator(manager, driver);

    const currentQuery = await orchestrator.generateCurrentContextQuery(
      "FLEXIBLE",
      baseUser.contexts[0]
    );

    const cypher = `${currentQuery}

RETURN dbCurrentUser.user_id AS userId,
       dbCurrentContext.context_id AS contextId,
       currentContextCompatibilityScore AS score
ORDER BY score DESC
LIMIT 5`;

    const result = await session.executeRead((tx) =>
      tx.run(cypher, { currentContext: baseUser.contexts[0] })
    );

    expect(result.records.length).toBeGreaterThan(0);
    const scores = result.records.map((record) => Number(record.get("score")));
    expect(scores.every((value) => value > 0)).toBe(true);
  });

  test("getOptimalFieldOrder sorts fields by estimated rows", async () => {
    const story = loadTestData("USER_001");
    await executeUpsertStory(driver, story);

    const manager = new PresetsManager(PRESETS_PATH);
    manager.load();
    const balanced = manager.get("BALANCED");
    const strictFields = balanced.strictPresets.map((preset) => preset.field);

    const estimates: { field: (typeof strictFields)[number]; rows: number }[] = [];
    for (const field of strictFields) {
      const value = (story.contexts[0] as any)[field];
      const explainQuery = buildExplainQuery(field, value);
      const explainResult = await session.executeRead((tx) =>
        tx.run(explainQuery, { value })
      );
      const rows =
        (explainResult.summary?.plan as any)?.arguments?.EstimatedRows ??
        FALLBACK_SELECTIVITY;
      estimates.push({ field, rows });
    }

    const expectedOrder = estimates
      .slice()
      .sort((a, b) => a.rows - b.rows)
      .map((entry) => entry.field);

    const optimalOrder = await getOptimalFieldOrder(
      driver,
      balanced.strictPresets,
      story.contexts[0]
    );

    expect(optimalOrder).toEqual(expectedOrder);
  });
});
