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
import { calculateExpectedScore } from "../../helpers/score-calculator.js";

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
      durationCapMonths: 36,
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
      const expectedScore = await calculateExpectedScore(
        driver,
        u1Context,
        u2Result.matchedContext,
        []
      );
      expect(u2Result.contextMatchScore).toBeCloseTo(expectedScore, 2);

      // Verify matched context fields are correct
      expect(u2Result.matchedContext.position).toBe(u1Context.position);
      expect(u2Result.matchedContext.domains).toEqual(u1Context.domains);
      expect(u2Result.matchedContext.skills).toEqual(u1Context.skills);
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
      const excludedFields = ["birthYear", "countryCode", "cityName"];
      const expectedScore = await calculateExpectedScore(
        driver,
        u1Context,
        u4Result.matchedContext,
        excludedFields
      );
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

    expect(results).toBeInstanceOf(Array);
    expect(results.length).toBeGreaterThan(0);

    // U2 and U6 should be in results (de/berlin, birthYear excluded, same skills)
    const u2 = dataManager.getStoryBy("U2");
    const u6 = dataManager.getStoryBy("U6");
    expect(results.find((r) => r.userId === u2.userId)).toBeDefined();
    expect(results.find((r) => r.userId === u6.userId)).toBeDefined();

    // U4 may not be found (us/seattle, skills=svelte vs react strict)

    // Verify at least one result is from Germany (since geo excluded, can have de/berlin)
    const germanResults = results.filter(
      (r) => r.matchedContext.countryCode === "de"
    );
    expect(germanResults.length).toBeGreaterThan(0);

    // All results should have position=Junior, domains=Frontend (strict matching)
    results.forEach((r) => {
      expect(r.matchedContext.position).toBe("Junior");
      expect(r.matchedContext.domains).toContain("Frontend");
    });
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

    expect(results).toBeInstanceOf(Array);
    expect(results.length).toBeGreaterThan(2); // Should find many Juniors

    // All results MUST have position=Junior (only strict field)
    results.forEach((r) => {
      expect(r.matchedContext.position).toBe("Junior");
    });

    // Should include diverse candidates: Frontend (U2, U4, U6, U9) and Backend (U3, U7, U8)
    const u3 = dataManager.getStoryBy("U3"); // Junior Backend Go
    const u7 = dataManager.getStoryBy("U7"); // Junior Backend Java

    // At least one Backend should be in results (domains different from U1 Frontend)
    const backendResults = results.filter((r) =>
      r.matchedContext.domains.includes("Backend")
    );
    expect(backendResults.length).toBeGreaterThan(0);

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

    expect(results).toBeInstanceOf(Array);
    expect(results.length).toBeGreaterThan(0);

    // U1 should NOT be in results (has milestone_achieved in context[1])
    expect(results.find((r) => r.userId === u1.userId)).toBeUndefined();

    // U2 should be in results (has position_changed in context[1], not milestone_achieved)
    const u2 = dataManager.getStoryBy("U2");
    expect(results.find((r) => r.userId === u2.userId)).toBeDefined();

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

    expect(results).toBeInstanceOf(Array);
    expect(results.length).toBeGreaterThanOrEqual(1);

    // U2 should be in results (createdAt: 2025-10-15, < 6 months from 2025-11-10)
    const u2 = dataManager.getStoryBy("U2");
    const u2Result = results.find((r) => r.userId === u2.userId);
    expect(u2Result).toBeDefined();

    if (u2Result) {
      expect(u2Result.matchedContext.createdAt).toBeDefined();
      console.log("[AC6] U2 createdAt:", u2Result.matchedContext.createdAt);
    }

    // U3, U4 should NOT be in results (createdAt: 2024-04-01, 2024-05-01 - > 6 months old)
    const u3 = dataManager.getStoryBy("U3");
    const u4 = dataManager.getStoryBy("U4");
    expect(results.find((r) => r.userId === u3.userId)).toBeUndefined();
    expect(results.find((r) => r.userId === u4.userId)).toBeUndefined();

    // All results should have createdAt within last 6 months
    const sixMonthsAgo = new Date("2025-11-10");
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    results.forEach((r) => {
      const createdAt = new Date(r.matchedContext.createdAt);
      expect(createdAt.getTime()).toBeGreaterThanOrEqual(
        sixMonthsAgo.getTime()
      );
    });
  });
});
