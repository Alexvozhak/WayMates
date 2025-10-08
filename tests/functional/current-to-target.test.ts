/**
 * 🧪 Бизнес-тест: current → target с динамическим оркестратором
 *
 * Проверяем end-to-end сценарий:
 * 1) Импортируем историю пользователя в БД
 * 2) Запускаем executeCurrentToTarget (динамический similar-contexts + target-transitions + metrics)
 * 3) Валидируем результат реальной схемой
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Driver, Session } from "neo4j-driver";
import {
  setupIntegrationTest,
  teardownIntegrationTest,
} from "../helpers/database-setup.js";
import { loadAllTestData } from "../helpers/test-data-loader.js";
import { executeUpsertStory } from "../../src/upsert-story.js";
import {
  CurrentToTargetParams,
  CurrentToTargetResultSchema,
  DEFAULT_STRICT_SKILL_CATEGORIES,
  type StoryInput,
} from "../../src/schemas-zod.js";
import { DEFAULT_SEARCH_CONSTRAINTS } from "../../src/unified-search-types.js";
import { executeCurrentToTarget } from "../../src/search-modes/current-to-target.js";

describe("Business: current-to-target orchestrated search", () => {
  let driver: Driver;
  let session: Session;
  let allStories: StoryInput[];

  beforeAll(async () => {
    allStories = loadAllTestData();

    ({ driver, session } = await setupIntegrationTest());

    for (const s of allStories) {
      await executeUpsertStory(driver, s);
    }
  });

  afterAll(async () => {
    await teardownIntegrationTest(session, driver);
  });

  it("imports all data and finds other users with target-like contexts", async () => {
    const story = allStories[0]!;
    const currentContext = story.contexts[0]!;
    const targetContext = story.contexts[story.contexts.length - 1]!;

    const params: CurrentToTargetParams = {
      currentContext,
      targetContext,
      searchConstraints: { ...DEFAULT_SEARCH_CONSTRAINTS, results_limit: 10 },
    };

    const result = await executeCurrentToTarget(driver, params);

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);

    // Валидируем схему и проверяем, что в выдаче есть пользователи, отличные от исходного
    const validated = result.map((r) => CurrentToTargetResultSchema.parse(r));
    const otherUsers = validated.filter((v) => v.userId !== story.user_id);

    expect(otherUsers.length).toBeGreaterThan(0);

    console.log(
      `🎉 Оркестратор успешно нашел ${result.length} переходов, из них ${otherUsers.length} от других пользователей!`
    );
  });
});
