/**
 * searchWaymates WITH DTW (trajectory ≥ 3 contexts)
 * Test data: U10-U13 from globalSetup
 */

import { describe, it, expect } from "vitest";
import { driver } from "../../helpers/drivers/shared-driver.js";
import { FixtureSearchManager, createWaymatesSearchParams } from "../../helpers/fixture-search-manager.js";
import { UserStories } from "../../helpers/user-stories.js";

function validateDtwFormula(
  userId: string,
  result: {
    dtwMetrics?: { shapeSimilarity: number; tempoSimilarity: number; alignmentScore: number } | undefined;
    dtwTotal?: number | null | undefined;
  },
) {
  if (result.dtwMetrics) {
    const { shapeSimilarity, tempoSimilarity, alignmentScore } = result.dtwMetrics;
    const calculatedTotal = shapeSimilarity + tempoSimilarity + alignmentScore;
    const dtwTotal = result.dtwTotal ?? 0;
    console.log(`[DTW] ${userId} formula breakdown:`, {
      shapeSimilarity,
      tempoSimilarity,
      alignmentScore,
      sum: calculatedTotal,
      dtwTotal,
    });
    expect(dtwTotal).toBeCloseTo(calculatedTotal, 2);
  }
}

describe("User Context Search WITH DTW (DT1-DT5)", () => {
  /**
   * Business rule: U10 (Backend Node.js) vs U11 (Backend Python) = VERY similar
   * Both: Backend domain, 3 contexts (Junior→Middle→Senior), identical durations, stable growth
   * Expected DTW: shapeSimilarity ~0.9, tempoSimilarity ~0.85, alignmentScore ~0.8, total ~2.55
   */
  it("DT1: High similarity - U10 (Backend Node.js) finds U11 (Backend Python) with high DTW scores", async () => {
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new UserStories();
    const u10 = dataManager.getStoryBy("U10");

    console.log("[DT1] Searching from U10 (Backend Node.js, 3 contexts)");
    console.log("[DT1] U10 trajectory:", {
      contexts: u10.contexts.length,
      positions: u10.contexts.map((c) => c.position),
      domains: u10.contexts.map((c) => c.domains),
    });

    const results = await searchManager.searchWaymates(
      createWaymatesSearchParams(u10.userId, {
        excludedContextFields: ["birthYear", "countryCode", "cityName"],
      }),
    );

    console.log("[DT1] Results count:", results.length);
    console.log(
      "[DT1] Results with DTW:",
      results.slice(0, 3).map((r) => ({
        userId: r.userId,
        position: r.matchedContext.position,
        domains: r.matchedContext.domains,
        shapeSimilarity: r.dtwMetrics?.shapeSimilarity,
        tempoSimilarity: r.dtwMetrics?.tempoSimilarity,
        alignmentScore: r.dtwMetrics?.alignmentScore,
        dtwTotal: r.dtwTotal,
      })),
    );

    const u11 = dataManager.getStoryBy("U11");
    const u11Result = results.find((r) => r.userId === u11.userId);
    expect(u11Result).toBeDefined();

    if (u11Result) {
      expect(u11Result.dtwMetrics).toBeDefined();

      const { shapeSimilarity, tempoSimilarity, alignmentScore } = u11Result.dtwMetrics!;
      const { dtwTotal } = u11Result;

      console.log("[DT1] U11 DTW metrics:", {
        shapeSimilarity,
        tempoSimilarity,
        alignmentScore,
        dtwTotal,
      });

      expect(shapeSimilarity).toBeGreaterThan(0.85);
      expect(tempoSimilarity).toBeGreaterThan(0.8);
      expect(alignmentScore).toBeGreaterThan(0.75);
      expect(dtwTotal).toBeGreaterThan(2.55);

      expect(shapeSimilarity).toBeGreaterThanOrEqual(0);
      expect(shapeSimilarity).toBeLessThanOrEqual(1);
      expect(tempoSimilarity).toBeGreaterThanOrEqual(0);
      expect(tempoSimilarity).toBeLessThanOrEqual(1);
      expect(alignmentScore).toBeGreaterThanOrEqual(0);
      expect(alignmentScore).toBeLessThanOrEqual(1);

      const calculatedTotal = shapeSimilarity + tempoSimilarity + alignmentScore;
      console.log("[DT1] DTW formula breakdown:", {
        shapeSimilarity,
        tempoSimilarity,
        alignmentScore,
        sum: calculatedTotal,
        dtwTotal,
        matches: Math.abs(calculatedTotal - dtwTotal!) < 0.01,
      });
      expect(dtwTotal).toBeCloseTo(calculatedTotal, 2);
    }
  });

  /**
   * Business rule: Different domains reduce DTW similarity despite similar career patterns
   * U10 (Backend) vs U12 (Frontend): shapeSimilarity 0.6-0.8, total 1.5-2.0 (medium)
   * U10 (Backend) vs U13 (Data Science): shapeSimilarity 0.6+, total 2.0-2.9 (high-medium)
   */
  it("DT2: Medium similarity - U10 finds U12 (Frontend) and U13 (Data Science) with medium DTW scores", async () => {
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new UserStories();
    const u10 = dataManager.getStoryBy("U10");

    console.log("[DT2] Searching from U10 for different domain trajectories (U12 Frontend, U13 Data Science)");

    const results = await searchManager.searchWaymates(
      createWaymatesSearchParams(u10.userId, {
        excludedContextFields: ["birthYear", "countryCode", "cityName"],
      }),
    );
    console.log("[DT2] Results count:", results.length);

    const u12 = dataManager.getStoryBy("U12");
    const u12Result = results.find((r) => r.userId === u12.userId);

    if (u12Result?.dtwMetrics) {
      validateDtwFormula("U12", u12Result);
      expect(u12Result.dtwMetrics.shapeSimilarity).toBeGreaterThan(0.6);
      expect(u12Result.dtwMetrics.shapeSimilarity).toBeLessThan(0.95);
      expect(u12Result.dtwTotal).toBeGreaterThan(1.5);
      expect(u12Result.dtwTotal).toBeLessThan(2.5);
    }

    const u13 = dataManager.getStoryBy("U13");
    const u13Result = results.find((r) => r.userId === u13.userId);

    if (u13Result?.dtwMetrics) {
      validateDtwFormula("U13", u13Result);
      expect(u13Result.dtwMetrics.shapeSimilarity).toBeGreaterThan(0.6);
      expect(u13Result.dtwMetrics.tempoSimilarity).toBeGreaterThan(0.6);
      expect(u13Result.dtwMetrics.alignmentScore).toBeGreaterThan(0.5);
      expect(u13Result.dtwTotal).toBeGreaterThan(2);
      expect(u13Result.dtwTotal).toBeLessThan(2.9);
    }
  });

  /**
   * Business rule: excludedCreationReasons filters out trajectories containing excluded reasons
   * U12 has "company_changed" in trajectory → excluded
   * U11, U13 have only "position_changed" → included
   */
  it("DT3: Excluded creation reasons - filters out users with company_changed in trajectory", async () => {
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new UserStories();
    const u10 = dataManager.getStoryBy("U10");

    console.log("[DT3] Searching with excludedCreationReasons: [company_changed]");
    console.log(
      "[DT3] U10 reasons:",
      u10.contexts.map((c) => c.creationReason),
    );

    const u12 = dataManager.getStoryBy("U12");
    console.log(
      "[DT3] U12 reasons (should be excluded):",
      u12.contexts.map((c) => c.creationReason),
    );

    const results = await searchManager.searchWaymates(
      createWaymatesSearchParams(u10.userId, {
        excludedContextFields: ["birthYear", "countryCode", "cityName"],
        excludedCreationReasons: ["company_changed"],
      }),
    );

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

    const u12Result = results.find((r) => r.userId === u12.userId);
    expect(u12Result).toBeUndefined();

    const u11 = dataManager.getStoryBy("U11");
    const u13 = dataManager.getStoryBy("U13");
    const hasU11 = results.some((r) => r.userId === u11.userId);
    const hasU13 = results.some((r) => r.userId === u13.userId);

    console.log("[DT3] U11 in results:", hasU11);
    console.log("[DT3] U13 in results:", hasU13);

    expect(hasU11 || hasU13).toBe(true);
  });

  /**
   * Business rule: Results ranked by dtwTotal (shape + tempo + stability)
   * Expected ranking: U11 (~2.55) > U13 (~2.0-2.6) > U12 (~1.5-2.0)
   * Validates DTW formula correctness for all results
   */
  it("DT4: Multiple candidates ranking - correctly orders by dtwTotal score", async () => {
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new UserStories();
    const u10 = dataManager.getStoryBy("U10");

    console.log("[DT4] Searching from U10 to rank multiple candidates by dtwTotal");

    const results = await searchManager.searchWaymates(
      createWaymatesSearchParams(u10.userId, {
        excludedContextFields: ["birthYear", "countryCode", "cityName", "role"],
      }),
    );

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

    const u11 = dataManager.getStoryBy("U11");
    const u12 = dataManager.getStoryBy("U12");
    const u13 = dataManager.getStoryBy("U13");

    const u11Result = results.find((r) => r.userId === u11.userId);
    const u12Result = results.find((r) => r.userId === u12.userId);
    const u13Result = results.find((r) => r.userId === u13.userId);

    expect(u11Result).toBeDefined();
    expect(u12Result).toBeDefined();
    expect(u13Result).toBeDefined();

    if (u11Result && u12Result && u13Result) {
      const u11Total = u11Result.dtwTotal ?? 0;
      const u12Total = u12Result.dtwTotal ?? 0;
      const u13Total = u13Result.dtwTotal ?? 0;

      console.log("[DT4] DTW totals:", { u11Total, u12Total, u13Total });

      expect(u11Total).toBeGreaterThan(u13Total);
      expect(u13Total).toBeGreaterThan(u12Total);

      expect(u11Total).toBeGreaterThan(2.55);
      expect(u13Total).toBeGreaterThan(2);
      expect(u13Total).toBeLessThan(2.9);
      expect(u12Total).toBeGreaterThan(1.5);
      expect(u12Total).toBeLessThan(2);

      validateDtwFormula("U11", u11Result);
      validateDtwFormula("U13", u13Result);
      validateDtwFormula("U12", u12Result);
    }
  });
});
