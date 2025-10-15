import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Driver } from "neo4j-driver";
import { createDriver, withWriteSession } from "../../src/neo4j.js";
import { runPipeline, DEFAULT_CONSTRAINTS } from "../helpers/fixture-runner.js";
import { SearchResultSchema } from "../../src/schemas-zod.js";
import { PersistenceManager } from "../../src/persistence-manager.js";
import { loadTestData } from "../helpers/test-data-loader.js";

describe("F01: Current to Target Search (Skill-focused)", () => {
  let driver: Driver;
  let persistenceManager: PersistenceManager;

  beforeAll(async () => {
    driver = createDriver();
    persistenceManager = new PersistenceManager(driver);
  });

  beforeEach(async () => {
    await withWriteSession(driver, (tx) => tx.run("MATCH (n) DETACH DELETE n"));

    // Seed test users
    for (const key of ["USER_002", "USER_015"]) {
      const story = loadTestData(key);
      await persistenceManager.upsertStory(story);
    }
  });

  afterAll(async () => {
    await driver.close();
  });

  it("should find similar users for career transition from Junior to Middle/Senior", async () => {
    const result = await runPipeline(
      driver,
      "USER_002",
      "SKILL_FOCUSED", // Current preset
      "BALANCED", // Target preset (broader matching)
      DEFAULT_CONSTRAINTS
    );

    // Validate result structure
    expect(result).toBeInstanceOf(Array);

    for (const item of result) {
      expect(() => SearchResultSchema.parse(item)).not.toThrow();

      // Business logic validation
      if (item.currentScore && item.targetScore) {
        expect(item.currentScore).toBeGreaterThan(0);
        expect(item.targetScore).toBeGreaterThan(0);
        // Target score should be comparable or higher than current for transition
        expect(item.targetScore).toBeGreaterThanOrEqual(
          item.currentScore * 0.8
        );
      }
    }

    // Should find at least some results (USER_002 has good skill overlap)
    expect(result.length).toBeGreaterThan(0);
  });

  it("should validate age and experience progression in results", async () => {
    const result = await runPipeline(
      driver,
      "USER_002",
      "SKILL_FOCUSED",
      "BALANCED",
      DEFAULT_CONSTRAINTS
    );

    for (const item of result) {
      if (item.currentContext && item.targetContext) {
        const currentAge =
          new Date().getFullYear() - item.currentContext.birth_year;
        const targetAge =
          new Date().getFullYear() - item.targetContext.birth_year;

        // Age should be reasonable for career progression
        expect(currentAge).toBeGreaterThan(20);
        expect(targetAge).toBeGreaterThanOrEqual(currentAge);

        // Experience progression should be logical
        const targetCreatedAt = item.targetContext.created_at;
        const currentCreatedAt = item.currentContext.created_at;

        let currentExp = 0;
        if (targetCreatedAt && currentCreatedAt) {
          const targetDate = new Date(targetCreatedAt).getTime();
          const currentDate = new Date(currentCreatedAt).getTime();
          const diffMs = targetDate - currentDate;
          const msPerMonth = 1000 * 60 * 60 * 24 * 30;
          currentExp = diffMs / msPerMonth;
        }
        if (currentExp > 0) {
          expect(currentExp).toBeGreaterThan(0);
          expect(currentExp).toBeLessThan(60); // Max 5 years between contexts
        }
      }
    }
  });
});
