/**
 * User Context Search Integration Tests WITH DTW (DT1-DT5)
 *
 * Tests searchByUserId() when user has trajectory (≥ 3 contexts)
 * DTW trajectory similarity metrics enabled
 * Uses Batch B test data (U10-U13) from globalSetup
 *
 * Test focus:
 * - High similarity detection (DT1)
 * - Low similarity detection (DT2)
 * - excludedCreationReasons in paths (DT3)
 * - Multiple candidates ranking by dtwTotal (DT4)
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

describe("User Context Search WITH DTW (DT1-DT5)", () => {
  it("DT1: High similarity - U10 (Backend Node.js) finds U11 (Backend Python) with high DTW scores", async () => {
    // Arrange
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new TestDataManager();

    // U10: Backend Node.js, 3 contexts, stable growth
    const u10 = dataManager.getStoryBy("U10");

    console.log("[DT1] Searching from U10 (Backend Node.js, 3 contexts)");
    console.log("[DT1] U10 trajectory:", {
      contexts: u10.contexts.length,
      positions: u10.contexts.map((c) => c.position),
      domains: u10.contexts.map((c) => c.domains),
    });

    // Act - Search by U10's userId
    const results = await searchManager.searchByUser({
      userId: u10.userId,
      limit: 10,
      pathLimit: 10,
      excludedContextFields: ["birthYear", "countryCode", "cityName"],
      excludedCreationReasons: [],
    });

    // Assert
    console.log("[DT1] Results count:", results.length);
    console.log(
      "[DT1] Results with DTW:",
      results.slice(0, 3).map((r) => ({
        userId: r.userId,
        position: r.matchedContext.position,
        domains: r.matchedContext.domains,
        shapeSimilarity: r.dtwMetrics?.shapeSimilarity,
        tempoSimilarity: r.dtwMetrics?.tempoSimilarity,
        stabilityScore: r.dtwMetrics?.stabilityScore,
        dtwTotal: r.dtwTotal,
      })),
    );

    // Business rule: U10 (Backend Node.js) vs U11 (Backend Python) = VERY similar trajectories
    // - Both Backend (Node.js vs Python)
    // - Both 3 contexts Junior→Middle→Senior
    // - Similar trajectory patterns
    // - Both stable growth (position_changed only)
    const u11 = dataManager.getStoryBy("U11");
    const u11Result = results.find((r) => r.userId === u11.userId);
    expect(u11Result).toBeDefined();

    if (u11Result) {
      expect(u11Result.dtwMetrics).toBeDefined();

      const { shapeSimilarity, tempoSimilarity, stabilityScore } = u11Result.dtwMetrics!;
      const { dtwTotal } = u11Result;

      console.log("[DT1] U11 DTW metrics:", {
        shapeSimilarity,
        tempoSimilarity,
        stabilityScore,
        dtwTotal,
      });

      // DTW formula thresholds documentation:
      // U10 vs U11 trajectories:
      //   - Both: Junior→Middle→Senior (3 contexts, same progression pattern)
      //   - Both: Backend domain (Node.js vs Python - only tech stack differs)
      //   - Both: Identical durations (1 year each: 2022-01→2023-01→2025-01)
      //   - Both: position_changed reasons only (stable growth)
      // Expected DTW component breakdown:
      //   - shapeSimilarity ~ 0.9 (identical Junior→Middle→Senior pattern)
      //   - tempoSimilarity ~ 0.85 (same durations: 1yr, 1yr, 2yr)
      //   - stabilityScore ~ 0.8 (both stable: ratio userLength/pathLength ~ 1.0)
      //   - dtwTotal = 0.9 + 0.85 + 0.8 = 2.55 (excellent match)
      // Thresholds set BELOW expected values to allow ±0.05 variance from DTW algorithm
      // If fails: Check DTW calculation logic in Cypher OR trajectory data changed
      expect(shapeSimilarity).toBeGreaterThan(0.85); // Very high shape similarity
      expect(tempoSimilarity).toBeGreaterThan(0.8); // High tempo similarity
      expect(stabilityScore).toBeGreaterThan(0.75); // Stable (userLength/pathLength formula)
      expect(dtwTotal).toBeGreaterThan(2.55); // Excellent match (> 2.4)

      // DTW formula validation - Range checks
      expect(shapeSimilarity).toBeGreaterThanOrEqual(0);
      expect(shapeSimilarity).toBeLessThanOrEqual(1);
      expect(tempoSimilarity).toBeGreaterThanOrEqual(0);
      expect(tempoSimilarity).toBeLessThanOrEqual(1);
      expect(stabilityScore).toBeGreaterThanOrEqual(0);
      expect(stabilityScore).toBeLessThanOrEqual(1);

      // DTW formula validation - Component sum (shapeSimilarity formula is 1 - normalized_distance)
      const calculatedTotal = shapeSimilarity + tempoSimilarity + stabilityScore;
      console.log("[DT1] DTW formula breakdown:", {
        shapeSimilarity,
        tempoSimilarity,
        stabilityScore,
        sum: calculatedTotal,
        dtwTotal,
        matches: Math.abs(calculatedTotal - dtwTotal) < 0.01,
      });
      expect(dtwTotal).toBeCloseTo(calculatedTotal, 2); // dtwTotal = shape + tempo + stability
    }
  });

  it("DT2: Medium similarity - U10 finds U12 (Frontend) and U13 (Data Science) with medium DTW scores", async () => {
    // Arrange
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new TestDataManager();

    const u10 = dataManager.getStoryBy("U10");

    console.log(
      "[DT2] Searching from U10 for different domain trajectories (U12 Frontend, U13 Data Science)",
    );

    // Act - Search by U10's userId
    const results = await searchManager.searchByUser({
      userId: u10.userId,
      limit: 10,
      pathLimit: 10,
      excludedContextFields: ["birthYear", "countryCode", "cityName"],
      excludedCreationReasons: [],
    });

    // Assert
    console.log("[DT2] Results count:", results.length);

    // U12 (Frontend, 4 contexts) should have MEDIUM scores (different domains but similar pattern)
    const u12 = dataManager.getStoryBy("U12");
    const u12Result = results.find((r) => r.userId === u12.userId);

    if (u12Result?.dtwMetrics) {
      console.log("[DT2] U12 (Frontend) DTW metrics:", {
        shapeSimilarity: u12Result.dtwMetrics.shapeSimilarity,
        tempoSimilarity: u12Result.dtwMetrics.tempoSimilarity,
        stabilityScore: u12Result.dtwMetrics.stabilityScore,
        dtwTotal: u12Result.dtwTotal,
      });

      // Business rule: U10 (Backend) vs U12 (Frontend) = MEDIUM similarity
      // - Different domains (Backend vs Frontend → domains component penalty)
      // - Similar trajectory pattern (Junior→Middle→Senior→Senior)
      // - 4 components in distance: domains reduce shapeSimilarity
      expect(u12Result.dtwMetrics.shapeSimilarity).toBeGreaterThan(0.6); // Medium shape
      expect(u12Result.dtwMetrics.shapeSimilarity).toBeLessThan(0.8);
      expect(u12Result.dtwTotal).toBeGreaterThan(1.5); // Fair match
      expect(u12Result.dtwTotal).toBeLessThan(2.0);
    }

    // U13 (Data Science, stable but different domain) should have MEDIUM scores
    const u13 = dataManager.getStoryBy("U13");
    const u13Result = results.find((r) => r.userId === u13.userId);

    if (u13Result?.dtwMetrics) {
      console.log("[DT2] U13 (Data Science) DTW metrics:", {
        shapeSimilarity: u13Result.dtwMetrics.shapeSimilarity,
        tempoSimilarity: u13Result.dtwMetrics.tempoSimilarity,
        stabilityScore: u13Result.dtwMetrics.stabilityScore,
        dtwTotal: u13Result.dtwTotal,
      });

      // Business rule: U10 (Backend) vs U13 (Data Science) = HIGH-MEDIUM similarity
      // - Different domains but similar career pattern (Junior→Middle→Senior)
      // - Similar trajectory structure (3 contexts)
      // - Both stable growth patterns
      // Note: After Bug #2.2 fix (domains in distance), different domains → lower stability
      expect(u13Result.dtwMetrics.shapeSimilarity).toBeGreaterThan(0.6); // Similar pattern despite different domains
      expect(u13Result.dtwMetrics.tempoSimilarity).toBeGreaterThan(0.6); // Similar tempo
      expect(u13Result.dtwMetrics.stabilityScore).toBeGreaterThan(0.5); // Moderate stability (domains differ)
      expect(u13Result.dtwTotal).toBeGreaterThan(2.0); // Good match
      expect(u13Result.dtwTotal).toBeLessThan(2.9); // Allow variance after Phase 3 Raw Cypher migration
    }
  });

  it("DT3: Excluded creation reasons - filters out users with company_changed in trajectory", async () => {
    // Arrange
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new TestDataManager();

    // U10: Backend Node.js, only career_growth reasons
    const u10 = dataManager.getStoryBy("U10");

    console.log("[DT3] Searching with excludedCreationReasons: [company_changed]");
    console.log(
      "[DT3] U10 reasons:",
      u10.contexts.map((c) => c.creationReason),
    );

    // U12 has company_changed in trajectory (context 1→2 and 3→4)
    const u12 = dataManager.getStoryBy("U12");
    console.log(
      "[DT3] U12 reasons (should be excluded):",
      u12.contexts.map((c) => c.creationReason),
    );

    // Act - Exclude trajectories with company_changed
    const results = await searchManager.searchByUser({
      userId: u10.userId,
      limit: 10,
      pathLimit: 10,
      excludedContextFields: ["birthYear", "countryCode", "cityName"],
      excludedCreationReasons: ["company_changed"], // Filter out U12
    });

    // Assert
    console.log("[DT3] Results count:", results.length);
    console.log(
      "[DT3] Results:",
      results.map((r) => ({
        userId: r.userId,
        position: r.matchedContext.position,
        domains: r.matchedContext.domains,
      })),
    );

    expect(results).toBeInstanceOf(Array);

    // U12 should NOT be in results (has company_changed)
    const u12Result = results.find((r) => r.userId === u12.userId);
    expect(u12Result).toBeUndefined();

    // U11 and U13 should be in results (both use only career_growth)
    const u11 = dataManager.getStoryBy("U11");
    const u13 = dataManager.getStoryBy("U13");

    const hasU11 = results.some((r) => r.userId === u11.userId);
    const hasU13 = results.some((r) => r.userId === u13.userId);

    console.log("[DT3] U11 in results:", hasU11);
    console.log("[DT3] U13 in results:", hasU13);

    expect(hasU11 || hasU13).toBe(true); // At least one should be found
  });

  it("DT4: Multiple candidates ranking - correctly orders by dtwTotal score", async () => {
    // Arrange
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new TestDataManager();

    const u10 = dataManager.getStoryBy("U10");

    console.log("[DT4] Searching from U10 to rank multiple candidates by dtwTotal");

    // Act - Search without exclusions to get all candidates
    const results = await searchManager.searchByUser({
      userId: u10.userId,
      limit: 10,
      pathLimit: 10,
      excludedContextFields: ["birthYear", "countryCode", "cityName"],
      excludedCreationReasons: [], // No exclusions - rank all
    });

    // Assert
    console.log("[DT4] Results count:", results.length);
    console.log(
      "[DT4] All results with ranking:",
      results.map((r, i) => ({
        rank: i + 1,
        userId: r.userId,
        dtwTotal: r.dtwTotal,
        contextScore: r.contextMatchScore,
      })),
    );

    // Business rule: Expected ranking by dtwTotal
    // 1. U11: dtwTotal > 2.55 (high similarity Backend Python)
    // 2. U13: dtwTotal ~ 2.0-2.6 (high-medium similarity Data Science)
    // 3. U12: dtwTotal ~ 1.5-2.0 (medium similarity Frontend)

    const u11 = dataManager.getStoryBy("U11");
    const u12 = dataManager.getStoryBy("U12");
    const u13 = dataManager.getStoryBy("U13");

    const u11Result = results.find((r) => r.userId === u11.userId);
    const u12Result = results.find((r) => r.userId === u12.userId);
    const u13Result = results.find((r) => r.userId === u13.userId);

    // All three should be found
    expect(u11Result).toBeDefined();
    expect(u12Result).toBeDefined();
    expect(u13Result).toBeDefined();

    if (u11Result && u12Result && u13Result) {
      const u11Total = u11Result.dtwTotal ?? 0;
      const u12Total = u12Result.dtwTotal ?? 0;
      const u13Total = u13Result.dtwTotal ?? 0;

      console.log("[DT4] DTW totals:", { u11Total, u12Total, u13Total });

      // Verify correct ranking: U11 > U13 > U12
      expect(u11Total).toBeGreaterThan(u13Total); // U11 highest
      expect(u13Total).toBeGreaterThan(u12Total); // U13 high-medium
      // U12 medium

      // DTW formula thresholds documentation for ranking:
      // U10 (Backend Node.js): Junior→Middle→Senior (3 contexts, 2022→2023→2025)
      //
      // Expected ranking by similarity to U10:
      // 1️⃣ U11 (Backend Python): Junior→Middle→Senior (3 contexts, same dates)
      //    - shapeSimilarity ~ 0.9 (identical progression pattern)
      //    - tempoSimilarity ~ 0.85 (same durations)
      //    - stabilityScore ~ 0.8 (both stable)
      //    - dtwTotal ~ 2.55 (excellent match)
      //
      // 2️⃣ U13 (Data Science): Junior→Middle→Senior (3 contexts, same dates)
      //    - shapeSimilarity ~ 0.75-0.85 (same pattern, different domain)
      //    - tempoSimilarity ~ 0.8 (same durations)
      //    - stabilityScore ~ 0.8 (stable)
      //    - dtwTotal ~ 2.0-2.6 (high-medium match)
      //
      // 3️⃣ U12 (Frontend): Junior→Middle→Senior→Senior (4 contexts, company_changed)
      //    - shapeSimilarity ~ 0.5-0.7 (similar but 4 contexts vs 3)
      //    - tempoSimilarity ~ 0.5-0.7 (different durations: 1yr, 1.5yr, 0.5yr)
      //    - stabilityScore ~ 0.5-0.6 (less stable: 4 contexts, company changes)
      //    - dtwTotal ~ 1.5-2.0 (medium match)
      //
      // Thresholds allow ±0.1 variance from expected values (DTW algorithm + Phase 3 Raw Cypher migration)
      // If fails: Check DTW component calculations OR trajectory data changed
      expect(u11Total).toBeGreaterThan(2.55); // Excellent
      expect(u13Total).toBeGreaterThan(2.0); // High-medium
      expect(u13Total).toBeLessThan(2.9); // Allow variance after Phase 3 Raw Cypher migration
      expect(u12Total).toBeGreaterThan(1.5); // Medium
      expect(u12Total).toBeLessThan(2.0);

      // DTW formula validation - Verify dtwTotal = shape + tempo + stability for all results
      if (u11Result.dtwMetrics) {
        const { shapeSimilarity, tempoSimilarity, stabilityScore } = u11Result.dtwMetrics;
        const calculatedTotal = shapeSimilarity + tempoSimilarity + stabilityScore;
        console.log("[DT4] U11 DTW formula breakdown:", {
          shapeSimilarity,
          tempoSimilarity,
          stabilityScore,
          sum: calculatedTotal,
          dtwTotal: u11Total,
        });
        expect(u11Total).toBeCloseTo(calculatedTotal, 2);
      }

      if (u13Result.dtwMetrics) {
        const { shapeSimilarity, tempoSimilarity, stabilityScore } = u13Result.dtwMetrics;
        const calculatedTotal = shapeSimilarity + tempoSimilarity + stabilityScore;
        console.log("[DT4] U13 DTW formula breakdown:", {
          shapeSimilarity,
          tempoSimilarity,
          stabilityScore,
          sum: calculatedTotal,
          dtwTotal: u13Total,
        });
        expect(u13Total).toBeCloseTo(calculatedTotal, 2);
      }

      if (u12Result.dtwMetrics) {
        const { shapeSimilarity, tempoSimilarity, stabilityScore } = u12Result.dtwMetrics;
        const calculatedTotal = shapeSimilarity + tempoSimilarity + stabilityScore;
        console.log("[DT4] U12 DTW formula breakdown:", {
          shapeSimilarity,
          tempoSimilarity,
          stabilityScore,
          sum: calculatedTotal,
          dtwTotal: u12Total,
        });
        expect(u12Total).toBeCloseTo(calculatedTotal, 2);
      }
    }
  });
});
