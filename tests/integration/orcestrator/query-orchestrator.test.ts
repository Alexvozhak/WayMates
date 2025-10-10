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
  buildExplainQuery,
} from "../../../src/orcestrator/selectivity-profiler.js";
import { Processors } from "../../../src/cypher/api.js";

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

    const currentStage = await orchestrator.generateCurrentContextQuery(
      "FLEXIBLE",
      baseUser.contexts[0]
    );
    const targetStage = orchestrator.generateTargetContextQuery("FLEXIBLE");

    const cypher = [
      currentStage,
      targetStage,
      Processors.COMPATIBILITY_SCORE,
    ].join("\n\n");

    const result = await session.executeRead((tx) =>
      tx.run(cypher, {
        currentContext: baseUser.contexts[0],
        targetContext: baseUser.contexts[1] || baseUser.contexts[0], // Используем второй контекст или первый если нет второго
      })
    );

    expect(result.records.length).toBeGreaterThan(0);
    const results = result.records.map((record) => record.get("result"));
    expect(
      results.every((result: any) => result.currentCompatibilityScore > 0)
    ).toBe(true);
  });

  test("getOptimalFieldOrder sorts fields by estimated rows", async () => {
    const story = loadTestData("USER_001");
    await executeUpsertStory(driver, story);

    const manager = new PresetsManager(PRESETS_PATH);
    manager.load();
    const balanced = manager.get("BALANCED");
    const strictFields = balanced.strictPresets.map((preset) => preset.field);

    const estimates: { field: (typeof strictFields)[number]; rows: number }[] =
      [];
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
      strictFields,
      story.contexts[0]
    );

    expect(optimalOrder).toEqual(expectedOrder);
  });

  describe("Required Fields Validation", () => {
    test("should throw error when current preset lacks required fields", async () => {
      const manager = new PresetsManager(PRESETS_PATH);
      manager.load();
      const orchestrator = new QueryOrchestrator(manager, driver);

      // Создаем тестовый пресет без обязательных полей
      const invalidPreset = {
        strictPresets: [
          { field: "industry" }, // Только industry, без position, domains, skills
        ],
        flexiblePresets: [{ field: "country_code", weight: 50 }],
      };

      // Добавляем временно невалидный пресет
      manager.add("INVALID_PRESET", invalidPreset);

      const testData = loadTestData("USER_001");
      const testContext = testData.contexts[0]!;

      await expect(
        orchestrator.generateCurrentContextQuery("INVALID_PRESET", testContext)
      ).rejects.toThrow(
        'Current preset "INVALID_PRESET" must include all required fields: position, domains, skills'
      );

      // Удаляем тестовый пресет
      manager.remove("INVALID_PRESET");
    });

    test("should pass validation when current preset has all required fields", async () => {
      const manager = new PresetsManager(PRESETS_PATH);
      manager.load();
      const orchestrator = new QueryOrchestrator(manager, driver);

      const testData = loadTestData("USER_001");
      const testContext = testData.contexts[0]!;

      // FLEXIBLE пресет должен содержать все обязательные поля
      await expect(
        orchestrator.generateCurrentContextQuery("FLEXIBLE", testContext)
      ).resolves.toBeDefined();
    });

    test("should pass validation when current preset has required fields plus additional ones", async () => {
      const manager = new PresetsManager(PRESETS_PATH);
      manager.load();
      const orchestrator = new QueryOrchestrator(manager, driver);

      // Создаем тестовый пресет с обязательными полями + дополнительными
      const validPreset = {
        strictPresets: [
          { field: "position" }, // Обязательное
          { field: "domains" }, // Обязательное
          { field: "skills" }, // Обязательное
          { field: "industry" }, // Дополнительное
        ],
        flexiblePresets: [{ field: "country_code", weight: 50 }],
      };

      manager.add("VALID_PRESET", validPreset);

      const testData = loadTestData("USER_001");
      const testContext = testData.contexts[0]!;

      await expect(
        orchestrator.generateCurrentContextQuery("VALID_PRESET", testContext)
      ).resolves.toBeDefined();

      // Удаляем тестовый пресет
      manager.remove("VALID_PRESET");
    });
  });
});
