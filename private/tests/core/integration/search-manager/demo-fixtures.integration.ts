/**
 * Demo Fixtures Verification Tests — Real Dialog Flow
 *
 * Simulates actual user journey:
 * 1. DEMO-EXPLORE: Search without goal → 8+ candidates (similar users)
 * 2. DEMO-RP: Validate goal via reverseSearchPathfinders → 6 candidates (4 pf + 2 reverse)
 * 3. DEMO-WM: Search waymates → 4 waymates (0005-0008)
 * 4. DEMO-PF: Search pathfinders → 4 pathfinders (0001-0004)
 *
 * Each test manages Alex's goal independently via goalsManager.
 */

import { targetSearchParamsSchema } from "@shared/schemas.js";
import { describe, expect, it } from "vitest";

import { DEFAULT_EXCLUDED_CONTEXT_FIELDS } from "../../../../../src/facade/langGraph/search-graph/types.js";
import {
  ALEX_TARGET_CONTEXT,
  DEMO_ALEX_USER_ID,
  driver,
  goalsManager,
  PATHFINDER_USER_IDS,
  REVERSE_PATHFINDER_USER_IDS,
  WAYMATE_USER_IDS,
} from "../../helpers/drivers/demo-fixtures-driver.js";
import { createPathfinderSearchParams, FixtureSearchManager } from "../../helpers/fixture-search-manager.js";

import type { AdhocContextBase } from "@shared/schemas.js";

/**
 * Alex's reference context (technical project manager, RU)
 */
const ALEX_REFERENCE_CONTEXT: AdhocContextBase = {
  position: "technical project manager",
  role: "manager",
  domains: ["management", "backend"],
  countryCode: "RU",
  citizenships: ["RU"],
  industry: "fintech",
  skills: null,
  companySize: null,
  cityName: null,
  birthYear: null,
  educationLevel: null,
  languages: null,
  salaryMin: null,
  salaryMax: null,
};

describe("Demo Fixtures — Real Dialog Flow", () => {
  /**
   * DEMO-EXPLORE: Search without goal (explore mode)
   *
   * Business rule: User hasn't set a goal yet, just exploring similar people.
   * searchWaymates without Alex's goal → returns all similar users (isWaymate based on THEIR goals).
   * Should find 8+ candidates: 4 waymates + 4 pathfinders (all have similar reference context).
   */
  it("DEMO-EXPLORE: searchWaymates (no Alex goal) finds 8+ similar users", async () => {
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();

    // Ensure Alex has NO goal (explore mode)
    await goalsManager.deleteGoal(DEMO_ALEX_USER_ID);

    console.log("[DEMO-EXPLORE] Searching without goal (explore mode)");

    try {
      const results = await searchManager.searchWaymates({
        userId: DEMO_ALEX_USER_ID,
        limit: 20,
        pathLimit: 10,
        excludedContextFields: [...DEFAULT_EXCLUDED_CONTEXT_FIELDS],
        excludedCreationReasons: [],
        recencyThresholdMonths: null,
        waymatesOnly: false,
      });

      console.log("[DEMO-EXPLORE] Results count:", results.length);
      console.log(
        "[DEMO-EXPLORE] Found candidates:",
        results.slice(0, 10).map((r) => ({
          userId: r.userId,
          position: r.matchedContext.position,
          isWaymate: r.isWaymate,
        })),
      );

      // Should find similar users (pathfinders have TPM in their trajectory too)
      expect(results.length).toBeGreaterThanOrEqual(8);
    } finally {
      // Cleanup: delete Alex goal (in case test set it)
      await goalsManager.deleteGoal(DEMO_ALEX_USER_ID);
    }
  });

  /**
   * DEMO-RP: Validate goal via reverseSearchPathfinders
   *
   * Business rule: User is considering a goal, wants to see who reached it.
   * Should find 6 candidates: 4 pathfinders + 2 reverse pathfinders.
   */
  it("DEMO-RP: reverseSearchPathfinders finds 6 candidates (4 pf + 2 reverse)", async () => {
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();

    // No Alex goal needed for reverseSearchPathfinders
    await goalsManager.deleteGoal(DEMO_ALEX_USER_ID);

    console.log("[DEMO-RP] Validating goal — who reached head of engineering in NL?");

    const params = targetSearchParamsSchema.parse({
      userId: DEMO_ALEX_USER_ID,
      targetContext: ALEX_TARGET_CONTEXT,
      excludedCreationReasons: [],
      recencyThresholdMonths: null,
      limit: 20,
    });

    const results = await searchManager.reverseSearchPathfinders(params);

    console.log("[DEMO-RP] Results count:", results.length);
    console.log(
      "[DEMO-RP] Found candidates:",
      results.map((r) => ({
        userId: r.userId,
        position: r.matchedContext.position,
        countryCode: r.matchedContext.countryCode,
      })),
    );

    const foundIds = new Set(results.map((r) => r.userId));

    // All 4 pathfinders should be found (they reached the goal)
    PATHFINDER_USER_IDS.forEach((id) => {
      expect(foundIds.has(id), `Pathfinder ${id} should be found in reverse search`).toBe(true);
    });

    // Both reverse pathfinders should be found
    REVERSE_PATHFINDER_USER_IDS.forEach((id) => {
      expect(foundIds.has(id), `Reverse pathfinder ${id} should be found`).toBe(true);
    });

    expect(results.length).toBeGreaterThanOrEqual(6);
  });

  /**
   * DEMO-WM: Search waymates with goal
   *
   * Business rule: Alex has set a goal, looking for peers with same goal.
   * Should find 4 waymates (0005-0008).
   */
  it("DEMO-WM: searchWaymates finds 4 demo waymates (0005-0008)", async () => {
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();

    // Set Alex goal for waymate matching
    await goalsManager.setGoal({
      userId: DEMO_ALEX_USER_ID,
      targetContext: ALEX_TARGET_CONTEXT,
    });

    console.log("[DEMO-WM] Searching waymates with goal set");

    try {
      const results = await searchManager.searchWaymates({
        userId: DEMO_ALEX_USER_ID,
        limit: 20,
        pathLimit: 10,
        excludedContextFields: [...DEFAULT_EXCLUDED_CONTEXT_FIELDS],
        excludedCreationReasons: [],
        recencyThresholdMonths: null,
        waymatesOnly: false,
      });

      console.log("[DEMO-WM] Results count:", results.length);
      console.log(
        "[DEMO-WM] Found waymates:",
        results
          .filter((r) => r.isWaymate)
          .map((r) => ({
            userId: r.userId,
            position: r.matchedContext.position,
            isWaymate: r.isWaymate,
          })),
      );

      const waymateResults = results.filter((r) => r.isWaymate);
      const foundWaymateIds = new Set(waymateResults.map((r) => r.userId));

      WAYMATE_USER_IDS.forEach((id) => {
        expect(foundWaymateIds.has(id), `Waymate ${id} should be found with isWaymate=true`).toBe(true);
      });

      expect(waymateResults.length).toBeGreaterThanOrEqual(4);
    } finally {
      await goalsManager.deleteGoal(DEMO_ALEX_USER_ID);
    }
  });

  /**
   * DEMO-PF: Search pathfinders
   *
   * Business rule: Alex has goal, looking for people who made similar transition.
   * Should find 4 pathfinders (0001-0004).
   */
  it("DEMO-PF: searchPathfinders finds 4 demo pathfinders (0001-0004)", async () => {
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();

    // Set Alex goal for pathfinder search
    await goalsManager.setGoal({
      userId: DEMO_ALEX_USER_ID,
      targetContext: ALEX_TARGET_CONTEXT,
    });

    console.log("[DEMO-PF] Searching pathfinders from Demo Alex context");

    try {
      const params = createPathfinderSearchParams(DEMO_ALEX_USER_ID, {
        referenceContext: ALEX_REFERENCE_CONTEXT,
        targetContext: ALEX_TARGET_CONTEXT,
        excludedContextFields: [...DEFAULT_EXCLUDED_CONTEXT_FIELDS],
      });

      const results = await searchManager.searchPathfinders(params);

      console.log("[DEMO-PF] Results count:", results.length);
      console.log(
        "[DEMO-PF] Found pathfinders:",
        results.map((r) => ({
          userId: r.userId,
          refPosition: r.path[0]?.position,
          targetPosition: r.path.at(-1)?.position,
          dtwTotal: r.dtwTotal,
        })),
      );

      const foundIds = new Set(results.map((r) => r.userId));
      PATHFINDER_USER_IDS.forEach((id) => {
        expect(foundIds.has(id), `Pathfinder ${id} should be found`).toBe(true);
      });

      expect(results.length).toBeGreaterThanOrEqual(4);
    } finally {
      await goalsManager.deleteGoal(DEMO_ALEX_USER_ID);
    }
  });
});
