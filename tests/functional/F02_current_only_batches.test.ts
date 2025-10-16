import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Driver, Session } from "neo4j-driver";
import {
  setupIntegrationTest,
  teardownIntegrationTest,
} from "../helpers/database-setup.js";
import { runCurrentBatches } from "../helpers/fixture-search-manager.js";
import { CurrentOnlyResultSchema } from "../../src/schemas-zod.js";
import { DEFAULT_CONSTRAINTS } from "../helpers/fixture-search-manager.js";

describe("F02: Current-Only Batches Search (Balanced)", () => {
  let driver: Driver;
  let session: Session;

  beforeAll(async () => {
    ({ driver, session } = await setupIntegrationTest());
  });

  afterAll(async () => {
    await teardownIntegrationTest(session, driver);
  });

  it("should return batches grouped by time periods with valid schema", async () => {
    const result = await runCurrentBatches(
      driver,
      "USER_001",
      "BALANCED",
      6,
      2,
      true
    );

    // Validate result structure
    expect(result).toBeInstanceOf(Array);
    expect(result.length).toBeGreaterThan(0);

    // Should have 3 batches: 6 months, 12 months, final
    expect(result.length).toBe(3);

    for (const batch of result) {
      expect(() => CurrentOnlyResultSchema.parse(batch)).not.toThrow();
      expect(batch.period).toBeGreaterThan(0);
      expect(batch.results).toBeInstanceOf(Array);

      for (const userResult of batch.results) {
        expect(userResult).toHaveProperty("userId");
        expect(userResult).toHaveProperty("currentLikeContextId");
        expect(userResult).toHaveProperty("compatibilityPercent");
        expect(userResult).toHaveProperty("transitionContextId");
        expect(userResult).toHaveProperty("contextTriggers");
        expect(userResult).toHaveProperty("monthsInPositionBeforeChange");
        expect(userResult).toHaveProperty("ageAtPositionChange");

        // Business logic validation
        expect(userResult.compatibilityPercent).toBeGreaterThan(0);
        expect(userResult.ageAtPositionChange).toBeGreaterThan(20);
        expect(userResult.monthsInPositionBeforeChange).toBeGreaterThan(0);
      }
    }
  });

  it("should validate progression timing in different batches", async () => {
    const result = await runCurrentBatches(
      driver,
      "USER_001",
      "BALANCED",
      12,
      1,
      false
    );

    // Should have 2 batches: 12 months and final (if any)
    expect(result.length).toBeGreaterThanOrEqual(1);

    const periods = result.map((b) => b.period);
    expect(periods).toContain(12);

    // Check that results in each batch have logical timing
    for (const batch of result) {
      for (const userResult of batch.results) {
        // Age should be reasonable
        expect(userResult.ageAtPositionChange).toBeGreaterThan(20);
        expect(userResult.ageAtPositionChange).toBeLessThan(50);

        // Experience before change should be positive and reasonable
        expect(userResult.monthsInPositionBeforeChange).toBeGreaterThan(0);
        expect(userResult.monthsInPositionBeforeChange).toBeLessThan(120); // Max 10 years
      }
    }
  });

  it("should handle edge case with no results in some batches", async () => {
    // Use a user with limited data that might not have matches in all periods
    const result = await runCurrentBatches(
      driver,
      "USER_007",
      "BALANCED",
      6,
      3,
      true
    );

    // Even if some batches are empty, schema should still be valid
    for (const batch of result) {
      expect(() => CurrentOnlyResultSchema.parse(batch)).not.toThrow();
      expect(batch.period).toBeGreaterThan(0);
      expect(batch.results).toBeInstanceOf(Array);
    }
  });
});
