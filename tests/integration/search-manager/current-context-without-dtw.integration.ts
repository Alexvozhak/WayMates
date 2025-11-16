/**
 * User Context Search Integration Tests WITHOUT DTW (UN1-UN4)
 *
 * Tests searchByUserId() when user has NO trajectory (single context)
 * Automatic fallback to searchByContext (Mode 1)
 * Uses Batch A test data (U1-U9) from globalSetup
 *
 * Test focus:
 * - No trajectory fallback (UN1)
 * - Exclude geo via userId (UN4)
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createDriver } from "../../../src/neo4j.js";
import { FixtureSearchManager } from "../../helpers/fixture-search-manager.js";
import { TestDataManager } from "../../helpers/test-data-manager.js";
import type { Driver } from "neo4j-driver";

let driver: Driver;

beforeAll(() => {
  driver = createDriver(); // Uses U1-U18 from globalSetup
});

afterAll(async () => {
  await driver.close();
});

describe("User Context Search WITHOUT DTW (UN1-UN4)", () => {
  it("UN1: No trajectory fallback - single context user falls back to searchByContext", async () => {
    // Arrange
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new TestDataManager();

    // U4 has only 1 context (Junior Frontend Svelte, us/seattle)
    const u4 = dataManager.getStoryBy("U4");
    const u4Context = u4.contexts[0]!;

    console.log("[UN1] Searching for user with single context (no trajectory)");
    console.log("[UN1] U4 context:", {
      position: u4Context.position,
      domains: u4Context.domains,
      skills: u4Context.skills,
      previousContextId: u4Context.previousContextId, // Should be null
    });

    expect(u4Context.previousContextId).toBeUndefined(); // Verify U4 has no trajectory

    // Act - Search by userId (should auto-fallback to searchByContext)
    const results = await searchManager.searchByUser({
      userId: u4.userId,
      limit: 10,
      pathLimit: 10,
      excludedContextFields: [
        "birthYear",
        "countryCode",
        "cityName",
        "languages",
        "domains",
        "skills",
        "industry",
        "companySize",
      ], // Exclude all except position to isolate fallback logic
      excludedCreationReasons: [],
    });

    // Assert
    console.log("[UN1] Results count:", results.length);
    console.log(
      "[UN1] Top results:",
      results.slice(0, 3).map((r) => ({
        userId: r.userId,
        position: r.matchedContext.position,
        domains: r.matchedContext.domains,
        hasDTW: !!r.dtwMetrics,
        hasPath: !!r.path,
      })),
    );

    // Business rule: Single context user → fallback to searchByContext (no DTW)
    // U7 should be in results (Junior Frontend, only Junior as current context, similar to U4)
    // Note: U1/U2/U6 current context is Middle (not Junior), so they won't match
    const u7 = dataManager.getStoryBy("U7");

    const hasU7 = results.some((r) => r.userId === u7.userId);

    expect(hasU7).toBe(true); // U7 should match (Junior current context)
  });

  it("UN4: Exclude geo via userId - resolveContext works correctly", async () => {
    // Arrange
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new TestDataManager();

    // U4 has single context (Junior Frontend Svelte, us/seattle)
    // We'll exclude geo to find international candidates
    const u4 = dataManager.getStoryBy("U4");
    const u4Context = u4.contexts[0]!;

    console.log("[UN4] Searching via userId with geo excluded");
    console.log("[UN4] U4 context:", {
      position: u4Context.position,
      domains: u4Context.domains,
      skills: u4Context.skills,
      geo: `${u4Context.countryCode}/${u4Context.cityName}`,
    });

    // Act - Search by userId with geo excluded (same as AC3 but via userId)
    const results = await searchManager.searchByUser({
      userId: u4.userId,
      limit: 10,
      pathLimit: 10,
      excludedContextFields: [
        "countryCode",
        "cityName",
        "birthYear",
        "languages",
        "domains",
        "skills",
        "industry",
        "companySize",
      ], // International search (isolate resolveContext logic)
      excludedCreationReasons: [],
    });

    // Assert
    console.log("[UN4] Results count:", results.length);
    console.log("[UN4] Countries found:", [
      ...new Set(results.map((r) => r.matchedContext.countryCode)),
    ]);

    // Business rule: resolveContext (userId → currentContextId) + geo excluded
    // U7 should be in results (Junior, current context matches U4)
    // Note: U1/U2/U6 current context is Middle (not Junior), so they won't match
    const u7 = dataManager.getStoryBy("U7");
    expect(results.find((r) => r.userId === u7.userId)).toBeTruthy();

    // Verify geo-diverse search works (U7 is from gb/london, U4 is from us/seattle)
    const internationalResults = results.filter((r) => r.matchedContext.countryCode !== "us");
    // Business rule: resolveContext (userId → currentContextId) + geo excluded → find geo-diverse candidates
    // Expected: U7 (Junior gb/london, current context)
    // Threshold: >= 1 (at least U7 should match)
    // If fails: International candidate incorrectly filtered OR resolveContext broke userId resolution
    expect(internationalResults.length).toBeGreaterThanOrEqual(1);
    console.log(
      `[UN4] International results count: ${internationalResults.length} (expected >= 1)`,
    );
  });
});
