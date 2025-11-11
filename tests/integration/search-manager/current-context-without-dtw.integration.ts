/**
 * User Context Search Integration Tests WITHOUT DTW (UN1-UN4)
 *
 * Tests searchByUserId() when user has NO trajectory (single context)
 * Automatic fallback to searchByContext (Mode 1)
 * Uses Batch A test data (U1-U9) - trajectories < 3 contexts
 *
 * Test focus:
 * - No trajectory fallback (UN1)
 * - Exclude geo via userId (UN4)
 */

import { describe, it, expect } from "vitest";
import { driver } from "./setup-read-only.js";
import { FixtureSearchManager } from "../../helpers/fixture-search-manager.js";
import { TestDataManager } from "../../helpers/test-data-manager.js";

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
      durationCapMonths: 36,
      excludedContextFields: ["birthYear", "countryCode", "cityName"], // Relaxed matching (skills MUST be strict)
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
      }))
    );

    expect(results).toBeInstanceOf(Array);
    expect(results.length).toBeGreaterThan(0);

    // All results should have NO DTW metrics (fallback to searchByContext)
    results.forEach((r) => {
      expect(r.dtwMetrics).toBeUndefined();
      expect(r.path).toBeUndefined();
      expect(r.contextMatchScore).toBeGreaterThan(0);
    });

    // U1, U2, U6 should be in results (Junior Frontend, geo excluded)
    const u1 = dataManager.getStoryBy("U1");
    const u2 = dataManager.getStoryBy("U2");
    const u6 = dataManager.getStoryBy("U6");

    const hasU1 = results.some((r) => r.userId === u1.userId);
    const hasU2 = results.some((r) => r.userId === u2.userId);
    const hasU6 = results.some((r) => r.userId === u6.userId);

    expect(hasU1 || hasU2 || hasU6).toBe(true); // At least one should match

    // Verify structure matches adhoc search (ScoredMatchedCandidate)
    const firstResult = results[0];
    expect(firstResult.userId).toBeDefined();
    expect(firstResult.matchedContext).toBeDefined();
    expect(firstResult.matchedContext.position).toBe("Junior");
    expect(firstResult.matchedContext.domains).toContain("Frontend");
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
      durationCapMonths: 36,
      excludedContextFields: ["countryCode", "cityName", "birthYear"], // International search (skills MUST be strict)
      excludedCreationReasons: [],
    });

    // Assert
    console.log("[UN4] Results count:", results.length);
    console.log("[UN4] Countries found:", [
      ...new Set(results.map((r) => r.matchedContext.countryCode)),
    ]);

    expect(results).toBeInstanceOf(Array);
    expect(results.length).toBeGreaterThan(0);

    // U1, U2, U6 should be in results (Junior Frontend svelte, geo excluded, same skills → high score)
    const u1 = dataManager.getStoryBy("U1");
    const u2 = dataManager.getStoryBy("U2");
    const u6 = dataManager.getStoryBy("U6");
    expect(
      results.find((r) => r.userId === u1.userId) ||
        results.find((r) => r.userId === u2.userId) ||
        results.find((r) => r.userId === u6.userId)
    ).toBeTruthy();

    // All results should have NO DTW (single context fallback)
    results.forEach((r) => {
      expect(r.dtwMetrics).toBeUndefined();
      expect(r.path).toBeUndefined();
    });

    // Verify at least one result from Germany
    const germanResults = results.filter(
      (r) => r.matchedContext.countryCode === "de"
    );
    expect(germanResults.length).toBeGreaterThan(0);

    // All results should have position=Junior, domains=Frontend (strict)
    results.forEach((r) => {
      expect(r.matchedContext.position).toBe("Junior");
      expect(r.matchedContext.domains).toContain("Frontend");
    });

    // Verify resolveContext worked (userId → current context)
    const firstResult = results[0];
    expect(firstResult.userId).toBeDefined();
    expect(firstResult.matchedContext).toBeDefined();
    expect(firstResult.contextMatchScore).toBeGreaterThan(0);
  });
});
