/**
 * 🧪 Функциональные тесты для SelectivityProfiler с PresetsManager
 */

import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { Driver, Session } from "neo4j-driver";
import { getOptimalFieldOrder } from "../../src/orcestrator/selectivity-profiler.js";
import { loadAllTestData, loadTestData } from "../helpers/test-data-loader.js";
import { executeUpsertStory } from "../../src/upsert-story.js";
import {
  setupIntegrationTest,
  teardownIntegrationTest,
} from "../helpers/database-setup.js";
import { type StrictPreset } from "../../src/schemas-zod.js";

describe("SelectivityProfiler Functional Tests", () => {
  let driver: Driver;
  let session: Session;

  beforeEach(async () => {
    ({ driver, session } = await setupIntegrationTest());

    const allTestData = loadAllTestData();
    for (const testStory of allTestData) {
      await executeUpsertStory(driver, testStory);
    }
  }, 30000);

  afterEach(async () => {
    await teardownIntegrationTest(session, driver);
  });

  test("должен правильно ранжировать поля по селективности", async () => {
    const testData = loadTestData("USER_001");
    const userContext = testData.contexts[0]!;

    const strictPresets: StrictPreset[] = [
      { field: "position" },
      { field: "domains" },
      { field: "skills" },
      { field: "industry" },
      { field: "country_code" },
      { field: "city_name" },
      { field: "work_type" },
      { field: "company_size" },
      { field: "team_size" },
      { field: "birth_year" },
    ];

    const result = await getOptimalFieldOrder(
      driver,
      strictPresets,
      userContext
    );

    // Проверяем что результат не пустой
    expect(result.length).toBeGreaterThan(0);

    // Проверяем что все поля из strictPresets присутствуют в результате
    const searchFields = strictPresets.map((p) => p.field);
    for (const field of searchFields) {
      if (userContext[field] !== undefined && userContext[field] !== null) {
        expect(result).toContain(field);
      }
    }

    // Проверяем что порядок логичен (более селективные поля первыми)
    // position обычно более селективен чем industry
    const positionIndex = result.indexOf("position");
    const industryIndex = result.indexOf("industry");

    if (positionIndex >= 0 && industryIndex >= 0) {
      expect(positionIndex).toBeLessThan(industryIndex);
    }
  });
});
