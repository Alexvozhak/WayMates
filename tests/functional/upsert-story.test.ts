import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { executeUpsertStory } from "../../src/upsert-story.js";

import type { Driver, Session } from "neo4j-driver";
import { loadTestData } from "../helpers/test-data-loader.js";
import {
  setupIntegrationTest,
  teardownIntegrationTest,
} from "../helpers/database-setup.js";
import { createDriver } from "../../src/neo4j.js";

describe("upsertStory Functional Tests", () => {
  const driver: Driver = createDriver();


  beforeEach(async () => {
    ({ driver, session } = await setupIntegrationTest());
  });

  afterEach(async () => {
    await teardownIntegrationTest(session, driver);
  });

  describe("upsertStory workflow", () => {
    test("creates trails with context ID mapping", async () => {
      const testData = loadTestData("USER_005");

      // Вызываем полный workflow (как в продакшене)
      const result = await executeUpsertStory(driver, testData);

      expect(result.success).toBe(true);
      expect(result.contextsCreated).toBeGreaterThan(0);
      expect(result.trailsCreated).toBeGreaterThan(0);
      expect(result.contextIdMap).toBeDefined();

      // Проверяем что маппинг работает (старые ID → новые ID)
      const originalFromContextId = testData.trails[0]!.from_context_id;
      const originalToContextId = testData.trails[0]!.to_context_id;

      // Находим старые ID в ключах contextIdMap
      const oldFromContextId = Array.from(result.contextIdMap!.keys()).find(
        (key) => result.contextIdMap!.get(key) === originalFromContextId
      );
      const oldToContextId = Array.from(result.contextIdMap!.keys()).find(
        (key) => result.contextIdMap!.get(key) === originalToContextId
      );

      expect(oldFromContextId).toBeDefined();
      expect(oldToContextId).toBeDefined();

      // Проверяем что тропы созданы с новыми ID
      const trailCheck = await session.run(
        `MATCH (from:Context)-[:STEPS_ON]->(t:Trail)
         MATCH (t:Trail)-[:STEPS_TO]->(to:Context)
         WHERE from.context_id = $from_id AND to.context_id = $to_id
         RETURN t.trail_id, from.context_id, to.context_id, t.skill, t.platform`,
        { from_id: originalFromContextId, to_id: originalToContextId }
      );

      expect(trailCheck.records).toHaveLength(1);
      const trail = trailCheck.records[0]!;

      // Проверяем что тропа связана с правильными контекстами
      expect(trail.get("t.skill")).toBe(testData.trails[0]!.skill);
      expect(trail.get("t.platform")).toBe(testData.trails[0]!.platform);

      // Проверяем что контексты существуют и связаны с пользователем
      const contextCheck = await session.run(
        `MATCH (u:User)-[:HAS_CONTEXT]->(c:Context)
         WHERE c.context_id IN [$from_id, $to_id] AND u.user_id = $user_id
         RETURN c.context_id`,
        {
          from_id: originalFromContextId,
          to_id: originalToContextId,
          user_id: testData.user_id,
        }
      );

      expect(contextCheck.records).toHaveLength(2);
    });
  });
});
