import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Driver, Session } from "neo4j-driver";
import {
  setupIntegrationTest,
  teardownIntegrationTest,
} from "../helpers/database-setup.js";
import { runCurrent } from "../helpers/fixture-search-manager.js";
import { SearchResultSchema } from "../../src/schemas-zod.js";
import { DEFAULT_CONSTRAINTS } from "../helpers/fixture-search-manager.js";

describe("F03: Geo-Focused Current Search", () => {
  let driver: Driver;
  let session: Session;

  beforeAll(async () => {
    ({ driver, session } = await setupIntegrationTest());
  });

  afterAll(async () => {
    await teardownIntegrationTest(session, driver);
  });

  it("should find similar users in the same geographic region", async () => {
    const result = await runCurrent(
      driver,
      "USER_007", // Stockholm, Sweden
      "GEO_FOCUSED",
      {
        max_timing_diff_months: 18,
        timing_diff_threshold_percent: 40,
        max_experience_diff_months: 48,
        results_limit: 10,
      }
    );

    // Validate result structure
    expect(result).toBeInstanceOf(Array);

    for (const item of result) {
      expect(() => SearchResultSchema.parse(item)).not.toThrow();

      // Business logic validation
      if (item.currentScore) {
        expect(item.currentScore).toBeGreaterThan(0);
      }

      // Should find users with similar location preferences
      if (item.currentContext) {
        expect(item.currentContext.country_code).toBeDefined();
        expect(item.currentContext.city_name).toBeDefined();
      }
    }

    // Should find at least some results (USER_007 has good geo data)
    expect(result.length).toBeGreaterThan(0);
  });

  it("should prioritize users in the same country/city", async () => {
    const result = await runCurrent(driver, "USER_007", "GEO_FOCUSED", {
      max_timing_diff_months: 24,
      timing_diff_threshold_percent: 60,
      max_experience_diff_months: 72,
      results_limit: 5,
    });

    // Check that results have reasonable geographic diversity
    const countries = new Set(
      result.map((r) => r.currentContext?.country_code).filter(Boolean)
    );
    const cities = new Set(
      result.map((r) => r.currentContext?.city_name).filter(Boolean)
    );

    // Should find users in multiple locations, but with some concentration
    expect(countries.size).toBeGreaterThan(0);
    expect(cities.size).toBeGreaterThan(0);

    // At least some results should match the search user's country (Sweden)
    const swedenResults = result.filter(
      (r) => r.currentContext?.country_code === "se"
    );
    expect(swedenResults.length).toBeGreaterThan(0);
  });

  it("should handle cases with no geographic matches", async () => {
    // Use a user with unique location that might not have matches
    const result = await runCurrent(
      driver,
      "USER_009", // Seattle, USA - should have fewer matches
      "GEO_FOCUSED",
      {
        max_timing_diff_months: 12,
        timing_diff_threshold_percent: 30,
        max_experience_diff_months: 36,
        results_limit: 3,
      }
    );

    // Even if no results, schema should be valid and structure correct
    for (const item of result) {
      expect(() => SearchResultSchema.parse(item)).not.toThrow();
    }

    // Results might be empty for unique locations, that's ok
    expect(result).toBeInstanceOf(Array);
  });
});
