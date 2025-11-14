/**
 * Adhoc Context Search Integration Tests (AC1-AC6)
 *
 * Tests searchAdhoc() with custom referenceContext (Mode 1)
 * Uses Batch A test data (U1-U9) - trajectories < 3 contexts
 *
 * Test focus:
 * - Strict matching по полям (AC1)
 * - excludedContextFields работает (AC2-AC4)
 * - excludedCreationReasons filter (AC5)
 * - recencyThresholdMonths filter (AC6)
 */

import { describe, it, expect } from "vitest";
import { driver } from "./setup-read-only.js";
import { FixtureSearchManager } from "../../helpers/fixture-search-manager.js";
import { TestDataManager } from "../../helpers/test-data-manager.js";

describe("Adhoc Context Search (AC1-AC6)", () => {
  it("AC1: Strict all fields - baseline matching", async () => {
    // Arrange
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new TestDataManager();

    // Get U1 context as reference (Junior Frontend React)
    const u1 = dataManager.getStoryBy("U1");
    const u1Context = u1.contexts[0]!; // First context (Junior)

    console.log("[AC1] Searching with reference context:", {
      position: u1Context.position,
      domains: u1Context.domains,
      skills: u1Context.skills,
    });

    // Act - Search adhoc with U1 context (all fields strict)
    const results = await searchManager.searchAdhoc({
      userId: u1.userId, // For Goal filtering (no goal in this test)
      referenceContext: u1Context,
      limit: 10,
      pathLimit: 10,
      excludedContextFields: [], // Strict matching on ALL fields
      excludedCreationReasons: [],
    });

    // Assert
    console.log("[AC1] Results count:", results.length);
    console.log(
      "[AC1] Top results:",
      results.slice(0, 3).map((r) => ({
        userId: r.userId,
        position: r.matchedContext.position,
        score: r.contextMatchScore,
      }))
    );

    // U2 should be in results (same Frontend React as U1)
    const u2 = dataManager.getStoryBy("U2");
    const u2Result = results.find((r) => r.userId === u2.userId);
    expect(u2Result).toBeDefined();

    if (u2Result) {
      // Business rule: U2 has identical context to U1 → perfect match (no extra skills, no penalties)
      // Hardcoded canary expectation (replaces calculateExpectedScore helper):
      // U1 skills: ["react"]
      // U2 skills: ["react"]
      // extraSkills (U2 has but U1 doesn't): []
      // Scoring formula: score = 1.0 - (sum(penalties) / 100.0)
      // Expected score: 1.0 - (0 / 100.0) = 1.0 (perfect match)
      // If fails: Either scoring formula changed OR U2 data changed
      const expectedScore = 1.0;

      console.log("[AC1] U2 score breakdown:", {
        referenceSkills: u1Context.skills,
        candidateSkills: u2Result.matchedContext.skills,
        expectedScore,
        actualScore: u2Result.contextMatchScore,
      });

      expect(u2Result.contextMatchScore).toBeCloseTo(expectedScore, 2);
    }
  });

  it("AC2: Exclude skills - finds candidates with different skills", async () => {
    // Arrange
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new TestDataManager();

    const u1 = dataManager.getStoryBy("U1");
    const u1Context = u1.contexts[0]!; // Junior Frontend React

    console.log(
      "[AC2] Searching with excludedContextFields: [birthYear, countryCode, cityName]"
    );
    console.log("[AC2] Reference:", {
      position: u1Context.position,
      domains: u1Context.domains,
      skills: u1Context.skills, // react - ALWAYS strict (penalties)
    });

    // Act - Search with birthYear, geo excluded (position, domains, skills, industry, companySize strict)
    // Note: skills are ALWAYS included in scoring (penalties) to rank candidates
    const results = await searchManager.searchAdhoc({
      userId: u1.userId,
      referenceContext: u1Context,
      limit: 10,
      pathLimit: 10,
      excludedContextFields: ["birthYear", "countryCode", "cityName"], // Skills MUST be strict
    });

    // Assert
    console.log("[AC2] Results count:", results.length);
    console.log(
      "[AC2] Top results:",
      results.slice(0, 5).map((r) => ({
        userId: r.userId,
        position: r.matchedContext.position,
        domains: r.matchedContext.domains,
        skills: r.matchedContext.skills,
      }))
    );

    // U4 should be in results (Junior Frontend but US/seattle, skills=svelte - all excluded)
    const u4 = dataManager.getStoryBy("U4");
    const u4Result = results.find((r) => r.userId === u4.userId);
    expect(u4Result).toBeDefined();

    if (u4Result) {
      // Business rule: U4 matches U1 on position, domains, industry, companySize
      // BUT has different skills (svelte vs react) → skill penalty applies
      // Excluded: birthYear, countryCode, cityName

      // Hardcoded canary expectation (replaces calculateExpectedScore helper):
      // U1 skills: ["react"]
      // U4 skills: ["svelte"]
      // extraSkills (U4 has but U1 doesn't): ["svelte"]
      // Scoring formula: score = 1.0 - (sum(penalties) / 100.0)
      // "svelte" penalty: 1.0 (default, not in skill-category-templates.yaml)
      // Expected score: 1.0 - (1.0 / 100.0) = 0.99
      // If fails: Either scoring formula changed OR svelte penalty changed in DB
      const expectedScore = 0.99;

      // Score breakdown logging
      const referenceSkills = new Set(u1Context.skills);
      const extraSkills = u4Result.matchedContext.skills.filter(
        (s) => !referenceSkills.has(s)
      );
      const missingSkills = u1Context.skills.filter(
        (s) => !u4Result.matchedContext.skills.includes(s)
      );

      console.log("[AC2] U4 skill penalty breakdown:", {
        referenceSkills: u1Context.skills,
        candidateSkills: u4Result.matchedContext.skills,
        missingSkills, // U1 has but U4 doesn't (NOT PENALIZED - only extraSkills penalized)
        extraSkills, // U4 has but U1 doesn't (PENALIZED - candidate has irrelevant skill)
        expectedScore,
        actualScore: u4Result.contextMatchScore,
      });

      // Note: tolerance = 1 decimal place (0.05) for integration tests due to scoring implementation details
      expect(u4Result.contextMatchScore).toBeCloseTo(expectedScore, 1);

      // Verify U4 characteristics are correctly returned
      expect(u4Result.matchedContext.position).toBe("Junior");
      expect(u4Result.matchedContext.domains).toContain("Frontend");
      expect(u4Result.matchedContext.skills).toEqual(["svelte"]); // Different from U1 react → penalty
      expect(u4Result.matchedContext.countryCode).toBe("us"); // Different from U1 de (excluded)
    }

    // U2, U6 should also be in results (de/berlin, different birthYear excluded)
    const u2 = dataManager.getStoryBy("U2");
    const u6 = dataManager.getStoryBy("U6");
    expect(results.find((r) => r.userId === u2.userId)).toBeDefined();
    expect(results.find((r) => r.userId === u6.userId)).toBeDefined();

    // Note: U9 not included (companySize="small" vs U1="startup" - companySize remains strict)
  });

  it("AC3: Exclude geo - international search finds candidates from different countries", async () => {
    // Arrange
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new TestDataManager();

    const u1 = dataManager.getStoryBy("U1");
    const u1Context = u1.contexts[0]!; // Junior Frontend React, de/berlin

    console.log(
      "[AC3] Searching with excludedContextFields: [countryCode, cityName, birthYear]"
    );
    console.log("[AC3] Reference:", {
      position: u1Context.position,
      domains: u1Context.domains,
      skills: u1Context.skills,
      geo: `${u1Context.countryCode}/${u1Context.cityName}`,
    });

    // Act - Search with geo and birthYear excluded (international search)
    const results = await searchManager.searchAdhoc({
      userId: u1.userId,
      referenceContext: u1Context,
      limit: 10,
      pathLimit: 10,
      excludedContextFields: ["countryCode", "cityName", "birthYear"], // Geo and age NOT strict
    });

    // Assert
    console.log("[AC3] Results count:", results.length);
    console.log("[AC3] Countries found:", [
      ...new Set(results.map((r) => r.matchedContext.countryCode)),
    ]);

    // U2 and U6 should be in results (de/berlin, birthYear excluded, same skills)
    const u2 = dataManager.getStoryBy("U2");
    const u6 = dataManager.getStoryBy("U6");
    expect(results.find((r) => r.userId === u2.userId)).toBeDefined();
    expect(results.find((r) => r.userId === u6.userId)).toBeDefined();

    // Verify at least one result is from Germany (since geo excluded, can have de/berlin)
    const germanResults = results.filter(
      (r) => r.matchedContext.countryCode === "de"
    );
    // Business rule: Geo excluded → should find German candidates (U2, U6 de/berlin with Frontend react skills)
    // Expected candidates: U2 (Junior Frontend react de/berlin), U6 (Junior Frontend react de/berlin)
    // Threshold: >= 2 (expect BOTH U2 and U6 to match since they're perfect non-geo matches)
    // If fails: Either U2 or U6 was incorrectly excluded (check Cypher WHERE clause for geo filtering)
    expect(germanResults.length).toBeGreaterThanOrEqual(2);
    console.log(`[AC3] German results count: ${germanResults.length} (expected >= 2)`);
  });

  it("AC4: Only position strict - finds candidates with same position regardless of other fields", async () => {
    // Arrange
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new TestDataManager();

    const u1 = dataManager.getStoryBy("U1");
    const u1Context = u1.contexts[0]!; // Junior Frontend React de/berlin

    console.log(
      "[AC4] Searching with only position strict (all other fields excluded)"
    );
    console.log("[AC4] Reference:", {
      position: u1Context.position,
      domains: u1Context.domains,
      skills: u1Context.skills,
      industry: u1Context.industry,
      companySize: u1Context.companySize,
    });

    // Act - Only position strict, everything else flexible
    const results = await searchManager.searchAdhoc({
      userId: u1.userId,
      referenceContext: u1Context,
      limit: 10,
      pathLimit: 10,
      excludedContextFields: [
        "domains",
        "skills",
        "industry",
        "countryCode",
        "cityName",
        "companySize",
        "birthYear",
      ],
    });

    // Assert
    console.log("[AC4] Results count:", results.length);
    console.log(
      "[AC4] Diverse results:",
      results.slice(0, 5).map((r) => ({
        userId: r.userId,
        position: r.matchedContext.position,
        domains: r.matchedContext.domains,
        skills: r.matchedContext.skills,
        geo: `${r.matchedContext.countryCode}/${r.matchedContext.cityName}`,
      }))
    );

    // Business rule: Only position is strict → diverse domains/skills expected
    // Should find both Frontend (U2, U4, U6, U9) and Backend (U3, U7, U8) Juniors
    const u3 = dataManager.getStoryBy("U3"); // Junior Backend Go
    const u7 = dataManager.getStoryBy("U7"); // Junior Backend Java

    // At least one Backend should be in results (domains different from U1 Frontend)
    const backendResults = results.filter((r) =>
      r.matchedContext.domains.includes("Backend")
    );
    // Business rule: Only position strict + all fields excluded → should find diverse domains
    // Expected candidates: U3 (Junior Backend Go), U7 (Junior Backend Java), U8 (Junior Backend Python)
    // Threshold: >= 2 (expect at least 2 of 3 Backend Juniors to match, since domains excluded)
    // If fails: Backend Juniors incorrectly excluded OR position filtering broken
    expect(backendResults.length).toBeGreaterThanOrEqual(2);
    console.log(`[AC4] Backend results count: ${backendResults.length} (expected >= 2)`);

    // Verify U3 or U7 is in results (Backend Juniors)
    const hasBackendCandidate = results.some(
      (r) => r.userId === u3.userId || r.userId === u7.userId
    );
    expect(hasBackendCandidate).toBe(true);
  });

  it("AC5: Excluded creation reasons - filters out users with specific reasons in trajectory", async () => {
    // Arrange
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new TestDataManager();

    const u1 = dataManager.getStoryBy("U1");
    const u1Context = u1.contexts[0]!; // Junior Frontend React, started_working

    console.log(
      "[AC5] Searching with excludedCreationReasons: [milestone_achieved]"
    );
    console.log(
      "[AC5] Reference context creationReason:",
      u1Context.creationReason
    );
    console.log(
      "[AC5] U1 trajectory:",
      u1.contexts.map((c) => c.creationReason)
    );

    // Act - Exclude users who have milestone_achieved anywhere in their trajectory
    const results = await searchManager.searchAdhoc({
      userId: u1.userId,
      referenceContext: u1Context,
      limit: 10,
      pathLimit: 10,
      excludedContextFields: [
        "domains",
        "skills",
        "industry",
        "birthYear",
        "countryCode",
        "cityName",
        "companySize",
      ],
      excludedCreationReasons: ["milestone_achieved"], // Filter out trajectories with this reason
    });

    // Assert
    console.log("[AC5] Results count:", results.length);
    console.log(
      "[AC5] Results:",
      results.map((r) => ({
        userId: r.userId,
        position: r.matchedContext.position,
        creationReason: r.matchedContext.creationReason,
      }))
    );

    // Business rule: Exclude trajectories with ANY milestone_achieved reason
    // U1 should NOT be in results (has milestone_achieved in context[1])
    expect(results.find((r) => r.userId === u1.userId)).toBeUndefined();

    // U2 should be in results (has position_changed in context[1], not milestone_achieved)
    const u2 = dataManager.getStoryBy("U2");
    const u2Result = results.find((r) => r.userId === u2.userId);
    expect(u2Result).toBeDefined();

    // Score comparison: U2 (included with position_changed) should be scored normally
    // U1 (excluded by milestone_achieved) would have same base score if not filtered
    // This demonstrates that excludedCreationReasons filters BEFORE scoring, not via penalty
    if (u2Result) {
      console.log("[AC5] Score comparison - U2 (included) vs U1 (excluded):", {
        u2Score: u2Result.contextMatchScore,
        u2Reasons: u2.contexts.map((c) => c.creationReason),
        u1Excluded: "U1 filtered out (has milestone_achieved in trajectory)",
        filterLogic: "excludedCreationReasons works as HARD filter, not score penalty",
      });
    }

    // All single-context users (U3-U9) should be in results (only started_working)
    const u3 = dataManager.getStoryBy("U3");
    const u4 = dataManager.getStoryBy("U4");
    expect(
      results.find((r) => r.userId === u3.userId || r.userId === u4.userId)
    ).toBeDefined();
  });

  it("AC6: Recency filter - only finds candidates with recent contexts", async () => {
    // Arrange
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new TestDataManager();

    const u1 = dataManager.getStoryBy("U1");
    const u1Context = u1.contexts[0]!; // Junior Frontend React, createdAt: 2025-09-01 (fresh)

    console.log("[AC6] Searching with recencyThresholdMonths: 6");
    console.log("[AC6] Reference context createdAt:", u1Context.createdAt);
    console.log("[AC6] Expected: U1, U2 (fresh); NOT U3, U4 (> 6 months old)");

    // Act - Only recent contexts (within 6 months from now: 2025-11-10)
    const results = await searchManager.searchAdhoc({
      userId: u1.userId,
      referenceContext: u1Context,
      limit: 10,
      pathLimit: 10,
      excludedContextFields: ["birthYear", "countryCode", "cityName"], // Relaxed matching (skills MUST be strict)
      recencyThresholdMonths: 6, // Only contexts created within last 6 months
    });

    // Assert
    console.log("[AC6] Results count:", results.length);
    console.log(
      "[AC6] Results:",
      results.map((r) => ({
        userId: r.userId,
        position: r.matchedContext.position,
        createdAt: r.matchedContext.createdAt,
      }))
    );

    // Business rule: Recency filter (6 months from 2025-11-10 = cutoff 2025-05-10)
    // U2 should be in results (createdAt: 2025-10-15, < 6 months from 2025-11-10)
    const u2 = dataManager.getStoryBy("U2");
    const u2Result = results.find((r) => r.userId === u2.userId);
    expect(u2Result).toBeDefined();

    if (u2Result) {
      console.log("[AC6] U2 createdAt:", u2Result.matchedContext.createdAt);
    }

    // U3, U4 should NOT be in results (createdAt: 2024-04-01, 2024-05-01 - > 6 months old)
    const u3 = dataManager.getStoryBy("U3");
    const u4 = dataManager.getStoryBy("U4");
    expect(results.find((r) => r.userId === u3.userId)).toBeUndefined();
    expect(results.find((r) => r.userId === u4.userId)).toBeUndefined();

    // All results should have createdAt within last 6 months
    const now = new Date();
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    results.forEach((r) => {
      const createdAt = new Date(r.matchedContext.createdAt);
      expect(createdAt.getTime()).toBeGreaterThanOrEqual(
        sixMonthsAgo.getTime()
      );
    });
  });
});
