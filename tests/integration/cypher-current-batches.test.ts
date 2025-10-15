import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Driver } from "neo4j-driver";
import { createDriver } from "../../src/neo4j.js";
import { runCurrentBatches } from "../helpers/fixture-runner.js";
import { BatchResultSchema } from "../../src/schemas-zod.js";

describe("Cypher Current Batches Query", () => {
  let driver: Driver;

  beforeAll(() => {
    driver = createDriver();
  });

  afterAll(async () => {
    await driver.close();
  });

  it("should execute buildCurrentBatchesQuery and return valid BatchResultSchema", async () => {
    // Seed test data using fixture
    const result = await runCurrentBatches(
      driver,
      "USER_001",
      "BALANCED",
      6,
      2,
      true
    );

    // Validate each batch result
    expect(result).toBeInstanceOf(Array);
    expect(result.length).toBeGreaterThan(0);

    for (const batch of result) {
      expect(() => BatchResultSchema.parse(batch)).not.toThrow();
      expect(batch.results).toBeInstanceOf(Array);

      if (batch.results.length > 0) {
        expect(batch.results[0]).toHaveProperty("userId");
        expect(batch.results[0]).toHaveProperty("currentLikeContextId");
        expect(batch.results[0]).toHaveProperty("compatibilityPercent");
        expect(batch.results[0]).toHaveProperty("transitionContextId");
        expect(batch.results[0]).toHaveProperty("contextTriggers");
        expect(batch.results[0]).toHaveProperty("monthsInPositionBeforeChange");
        expect(batch.results[0]).toHaveProperty("ageAtPositionChange");
      }
    }
  });

  it("should handle datetime() conversion in Neo4j correctly", async () => {
    const result = await runCurrentBatches(
      driver,
      "USER_002",
      "SKILL_FOCUSED",
      12,
      1,
      false
    );

    // Verify age calculation works (birth_year from USER_002 context)
    if (result.length > 0 && result[0]!.results.length > 0) {
      const firstResult = result[0]!.results[0];
      expect(firstResult?.ageAtPositionChange).toBeGreaterThan(20);
      expect(firstResult?.ageAtPositionChange).toBeLessThan(50);
    }
  });

  it("should generate correct periods for stepSizeMonths=6 and numberOfSteps=2", async () => {
    const result = await runCurrentBatches(
      driver,
      "USER_001",
      "BALANCED",
      6,
      2,
      false
    );

    // Should have 2 batches: 6 months and 12 months
    expect(result).toHaveLength(2);
    expect(result[0]!.period).toBe(6);
    expect(result[1]!.period).toBe(12);
  });

  it("should include final batch when includeFinalBatch=true", async () => {
    const result = await runCurrentBatches(
      driver,
      "USER_001",
      "BALANCED",
      6,
      1,
      true
    );

    // Should have 2 batches: 6 months + final batch
    expect(result).toHaveLength(2);
    expect(result[0]!.period).toBe(6);
    expect(result[1]!.period).toBe(-1); // Final batch has period = -1
  });

  it("should handle different step sizes correctly", async () => {
    const result = await runCurrentBatches(
      driver,
      "USER_002",
      "SKILL_FOCUSED",
      3,
      3,
      false
    );

    // Should have 3 batches: 3, 6, 9 months
    expect(result).toHaveLength(3);
    expect(result[0]!.period).toBe(3);
    expect(result[1]!.period).toBe(6);
    expect(result[2]!.period).toBe(9);
  });

  it("should validate schema for all batch results", async () => {
    const result = await runCurrentBatches(
      driver,
      "USER_004",
      "BALANCED",
      6,
      2,
      true
    );

    // Validate each batch has correct structure
    for (const batch of result) {
      expect(batch).toHaveProperty("period");
      expect(batch).toHaveProperty("results");
      expect(batch.results).toBeInstanceOf(Array);

      // Period should be a number: positive for regular batches, -1 for final batch
      expect(typeof batch.period).toBe("number");
      expect(batch.period === -1 || batch.period > 0).toBe(true);
    }
  });
});
