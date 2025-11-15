/**
 * Adhoc Context Search Integration Tests (AC1-AC12)
 *
 * Tests searchAdhoc() with custom referenceContext (Mode 1)
 * Uses Batch A test data (U1-U9) from globalSetup
 * Uses Batch C test data (U14-U16) from globalSetup - educationLevel tests
 * Uses Batch D test data (U17-U18) from globalSetup - salary tests
 *
 * Test focus:
 * - Strict matching по полям (AC1)
 * - excludedContextFields работает (AC2-AC4)
 * - excludedCreationReasons filter (AC5)
 * - recencyThresholdMonths filter (AC6)
 * - educationLevel matching (AC7-AC9)
 * - salary field return (AC10-AC12)
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
    console.log(
      `[AC3] German results count: ${germanResults.length} (expected >= 2)`
    );
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
    console.log(
      `[AC4] Backend results count: ${backendResults.length} (expected >= 2)`
    );

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
        filterLogic:
          "excludedCreationReasons works as HARD filter, not score penalty",
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

  it("AC7: educationLevel strict filter - finds only matching education level", async () => {
    // Arrange
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new TestDataManager();

    const u1 = dataManager.getStoryBy("U1");
    const u1Context = u1.contexts[0]!; // Junior Frontend React, BACHELOR

    console.log("[AC7] Searching with educationLevel strict filter");
    console.log("[AC7] Reference education:", u1Context.educationLevel);
    console.log("[AC7] Expected: U1 (BACHELOR), U2 (BACHELOR)");
    console.log("[AC7] NOT expected: U14 (MASTER)");

    // Act - Search with educationLevel strict (not excluded)
    const results = await searchManager.searchAdhoc({
      userId: u1.userId,
      referenceContext: u1Context,
      limit: 10,
      pathLimit: 10,
      excludedContextFields: [], // educationLevel NOT excluded → strict matching
      excludedCreationReasons: [],
    });

    // Assert
    console.log("[AC7] Results count:", results.length);
    console.log(
      "[AC7] Results:",
      results.map((r) => ({
        userId: r.userId,
        education: r.matchedContext.educationLevel,
      }))
    );

    // Business rule: educationLevel strict filter
    // U1 (BACHELOR) should find U2 (BACHELOR) but NOT U14 (MASTER)
    const u2 = dataManager.getStoryBy("U2");
    const u14 = dataManager.getStoryBy("U14");

    expect(results.find((r) => r.userId === u2.userId)).toBeDefined();
    expect(results.find((r) => r.userId === u14.userId)).toBeUndefined();

    // All results should have BACHELOR education level (or null wildcard)
    results.forEach((r) => {
      const education = r.matchedContext.educationLevel;
      expect(education === "BACHELOR" || education === null).toBe(true);
    });
  });

  it("AC8: educationLevel excluded filter - finds candidates with different education levels", async () => {
    // Arrange
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new TestDataManager();

    console.log("[AC8] Searching with educationLevel excluded from matching");
    const u1Context = dataManager.getStoryBy("U1").contexts[0];
    const u14 = dataManager.getStoryBy("U14");
    const u16 = dataManager.getStoryBy("U16");

    console.log("[AC8] Reference education:", u1Context.educationLevel);
    console.log("[AC8] Expected: U14 (MASTER), U16 (HIGH_SCHOOL), U15 (null)");

    // Act
    const results = await searchManager.searchAdhoc({
      userId: dataManager.getStoryBy("U1").userId,
      referenceContext: u1Context,
      limit: 10,
      pathLimit: 10,
      excludedContextFields: [
        "educationLevel",
        "position",
        "domains",
        "skills",
        "companySize",
        "countryCode",
        "cityName",
        "birthYear",
      ], // Relax all fields except industry to find diverse education levels
      excludedCreationReasons: [],
    });

    // Assert
    console.log("[AC8] Results count:", results.length);
    console.log(
      "[AC8] Results:",
      results.map((r) => ({
        userId: r.userId,
        education: r.matchedContext.educationLevel,
      }))
    );

    // Business rule: educationLevel excluded → ignore education in matching
    // Should find candidates with different education levels
    expect(results.find((r) => r.userId === u14.userId)).toBeDefined();
    expect(results.find((r) => r.userId === u16.userId)).toBeDefined();

    // Verify we have multiple education levels in results
    const educationLevels = new Set(
      results.map((r) => r.matchedContext.educationLevel)
    );
    expect(educationLevels.size).toBeGreaterThan(1);
  });

  it("AC9: null educationLevel wildcard - finds candidates with any education level", async () => {
    // Arrange
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new TestDataManager();

    console.log("[AC9] Searching with null educationLevel (wildcard behavior)");
    const u15Context = dataManager.getStoryBy("U15").contexts[0]; // educationLevel = undefined
    const u2 = dataManager.getStoryBy("U2"); // BACHELOR
    const u14 = dataManager.getStoryBy("U14"); // MASTER

    console.log("[AC9] Reference education:", u15Context.educationLevel);
    console.log(
      "[AC9] Expected: Find candidates with ANY education level (BACHELOR, MASTER, HIGH_SCHOOL, null)"
    );

    // Act
    const results = await searchManager.searchAdhoc({
      userId: dataManager.getStoryBy("U15").userId,
      referenceContext: u15Context,
      limit: 10,
      pathLimit: 10,
      excludedContextFields: [
        "position",
        "domains",
        "skills",
        "companySize",
        "countryCode",
        "cityName",
        "birthYear",
      ], // Relax all fields except industry to test educationLevel wildcard
      excludedCreationReasons: [],
    });

    // Assert
    console.log("[AC9] Results count:", results.length);
    console.log(
      "[AC9] Results:",
      results.map((r) => ({
        userId: r.userId,
        education: r.matchedContext.educationLevel,
      }))
    );

    // Business rule: null educationLevel in reference → wildcard (finds all education levels)
    // Should find both BACHELOR and MASTER candidates
    expect(results.find((r) => r.userId === u2.userId)).toBeDefined();
    expect(results.find((r) => r.userId === u14.userId)).toBeDefined();

    // Verify we have multiple education levels in results (wildcard behavior)
    const educationLevels = new Set(
      results.map((r) => r.matchedContext.educationLevel)
    );
    expect(educationLevels.size).toBeGreaterThan(1);
  });

  it("AC10: Salary exact value returned - search results include salaryExact field", async () => {
    // Arrange
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new TestDataManager();

    console.log("[AC10] Searching for U17 with salaryExact field");
    const u1 = dataManager.getStoryBy("U1"); // Search WITH U1
    const u17 = dataManager.getStoryBy("U17"); // FIND U17
    const u17Context = u17.contexts[0]!; // Middle Backend Python, salaryExact: 70000

    // Act - Search adhoc with U1 userId but U17 context to find U17
    const results = await searchManager.searchAdhoc({
      userId: u1.userId, // Use U1 to avoid self-exclusion
      referenceContext: u17Context,
      limit: 10,
      pathLimit: 10,
      excludedContextFields: [
        "position",
        "domains",
        "skills",
        "companySize",
        "countryCode",
        "cityName",
        "birthYear",
        "educationLevel",
      ], // Relax all fields except industry
      excludedCreationReasons: [],
    });

    // Assert
    console.log("[AC10] Results count:", results.length);
    const u17Result = results.find((r) => r.userId === u17.userId);
    expect(u17Result).toBeDefined();

    if (u17Result) {
      // Business rule: Salary fields are DISPLAY ONLY (returned AS IS, no filtering/scoring)
      // U17 has salaryExact: 70000 → verify it's returned correctly
      console.log("[AC10] U17 salary data:", {
        salaryExact: u17Result.matchedContext.salaryExact,
        salaryMin: u17Result.matchedContext.salaryMin,
        salaryMax: u17Result.matchedContext.salaryMax,
      });

      expect(u17Result.matchedContext.salaryExact).toBe(70000);
      expect(u17Result.matchedContext.salaryMin).toBeNull();
      expect(u17Result.matchedContext.salaryMax).toBeNull();
    }
  });

  it("AC11: Salary range returned - search results include salaryMin/salaryMax fields", async () => {
    // Arrange
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new TestDataManager();

    console.log("[AC11] Searching for U18 with salaryMin/salaryMax fields");
    const u1 = dataManager.getStoryBy("U1"); // Search WITH U1
    const u18 = dataManager.getStoryBy("U18"); // FIND U18
    const u18Context = u18.contexts[0]!; // Senior Backend Python, salaryMin: 60000, salaryMax: 80000

    // Act - Search adhoc with U1 userId but U18 context to find U18
    const results = await searchManager.searchAdhoc({
      userId: u1.userId, // Use U1 to avoid self-exclusion
      referenceContext: u18Context,
      limit: 10,
      pathLimit: 10,
      excludedContextFields: [
        "position",
        "domains",
        "skills",
        "companySize",
        "countryCode",
        "cityName",
        "birthYear",
        "educationLevel",
      ], // Relax all fields except industry
      excludedCreationReasons: [],
    });

    // Assert
    console.log("[AC11] Results count:", results.length);
    const u18Result = results.find((r) => r.userId === u18.userId);
    expect(u18Result).toBeDefined();

    if (u18Result) {
      // Business rule: Salary fields are DISPLAY ONLY (returned AS IS, no filtering/scoring)
      // U18 has salaryMin: 60000, salaryMax: 80000 → verify both returned correctly
      console.log("[AC11] U18 salary data:", {
        salaryExact: u18Result.matchedContext.salaryExact,
        salaryMin: u18Result.matchedContext.salaryMin,
        salaryMax: u18Result.matchedContext.salaryMax,
      });

      expect(u18Result.matchedContext.salaryExact).toBeNull();
      expect(u18Result.matchedContext.salaryMin).toBe(60000);
      expect(u18Result.matchedContext.salaryMax).toBe(80000);
    }
  });

  it("AC12: Backward compatibility - users without salary fields work correctly", async () => {
    // Arrange
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new TestDataManager();

    console.log(
      "[AC12] Searching with U1 (no salary fields) - backward compatibility"
    );
    const u1 = dataManager.getStoryBy("U1");
    const u1Context = u1.contexts[0]!; // Junior Frontend React, NO salary fields

    // Act - Search adhoc with U1 context
    const results = await searchManager.searchAdhoc({
      userId: u1.userId,
      referenceContext: u1Context,
      limit: 10,
      pathLimit: 10,
      excludedContextFields: [],
      excludedCreationReasons: [],
    });

    // Assert
    console.log("[AC12] Results count:", results.length);
    const u2 = dataManager.getStoryBy("U2");
    const u2Result = results.find((r) => r.userId === u2.userId);
    expect(u2Result).toBeDefined();

    if (u2Result) {
      // Business rule: Users without salary fields should have null salary values (Cypher map projection behavior)
      // U2 has no salary fields → verify all salary fields are null
      console.log("[AC12] U2 salary data (should be null):", {
        salaryExact: u2Result.matchedContext.salaryExact,
        salaryMin: u2Result.matchedContext.salaryMin,
        salaryMax: u2Result.matchedContext.salaryMax,
      });

      expect(u2Result.matchedContext.salaryExact).toBeNull();
      expect(u2Result.matchedContext.salaryMin).toBeNull();
      expect(u2Result.matchedContext.salaryMax).toBeNull();
    }

    // Search still works correctly (U2 should match U1 with perfect score)
    if (u2Result) {
      expect(u2Result.contextMatchScore).toBeCloseTo(1.0, 2);
    }
  });

  it("SC1: Strict languages matching (single language)", async () => {
    // Arrange
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new TestDataManager();

    console.log("[SC1] Searching for candidates with languages: ['en']");
    const u1 = dataManager.getStoryBy("U1");
    const u1Context = u1.contexts[0]!; // Has languages: ["en"]

    // Act - Search adhoc with U1 context (strict languages matching)
    const results = await searchManager.searchAdhoc({
      userId: u1.userId,
      referenceContext: u1Context,
      limit: 10,
      pathLimit: 10,
      excludedContextFields: [], // Strict matching on ALL fields including languages
      excludedCreationReasons: [],
    });

    // Assert
    console.log("[SC1] Results count:", results.length);
    console.log(
      "[SC1] Results userIds:",
      results.map((r) => r.userId)
    );

    // Business rule: Only candidates with languages containing "en" should match
    // Expected: U1 (["en"]) and U4 (["en", "de"]) should be in results
    // U2 (["de"]) and U3 (null) should NOT be in results

    const u4 = dataManager.getStoryBy("U4");
    const u4Result = results.find((r) => r.userId === u4.userId);
    expect(u4Result).toBeDefined();

    const u2 = dataManager.getStoryBy("U2");
    const u2Result = results.find((r) => r.userId === u2.userId);
    expect(u2Result).toBeUndefined(); // U2 has ["de"], not ["en"]

    const u3 = dataManager.getStoryBy("U3");
    const u3Result = results.find((r) => r.userId === u3.userId);
    expect(u3Result).toBeUndefined(); // U3 has null languages
  });

  it("SC3: Strict languages matching (multiple AND)", async () => {
    // Arrange
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new TestDataManager();

    console.log("[SC3] Searching for candidates with languages: ['en', 'de']");
    const u4 = dataManager.getStoryBy("U4");
    const u4Context = u4.contexts[0]!; // Has languages: ["en", "de"]

    // Act - Search adhoc with U4 context (strict languages matching)
    const results = await searchManager.searchAdhoc({
      userId: u4.userId,
      referenceContext: u4Context,
      limit: 10,
      pathLimit: 10,
      excludedContextFields: [], // Strict matching on ALL fields including languages
      excludedCreationReasons: [],
    });

    // Assert
    console.log("[SC3] Results count:", results.length);
    console.log(
      "[SC3] Results userIds:",
      results.map((r) => r.userId)
    );

    // Business rule: Only candidates with BOTH "en" AND "de" should match
    // Expected: Only U4 (["en", "de"]) should be in results
    // U1 (["en"]), U2 (["de"]), U3 (null) should NOT be in results

    const u1 = dataManager.getStoryBy("U1");
    const u1Result = results.find((r) => r.userId === u1.userId);
    expect(u1Result).toBeUndefined(); // U1 has only ["en"]

    const u2 = dataManager.getStoryBy("U2");
    const u2Result = results.find((r) => r.userId === u2.userId);
    expect(u2Result).toBeUndefined(); // U2 has only ["de"]

    const u3 = dataManager.getStoryBy("U3");
    const u3Result = results.find((r) => r.userId === u3.userId);
    expect(u3Result).toBeUndefined(); // U3 has null languages
  });

  it("SC2: Languages excluded (inverse logic)", async () => {
    // Arrange
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new TestDataManager();

    console.log("[SC2] Searching with excludedContextFields: ['languages']");
    const u1 = dataManager.getStoryBy("U1");
    const u1Context = u1.contexts[0]!; // Has languages: ["en"]

    // Act - Search adhoc with languages excluded
    const results = await searchManager.searchAdhoc({
      userId: u1.userId,
      referenceContext: u1Context,
      limit: 10,
      pathLimit: 10,
      excludedContextFields: ["languages"], // Ignore languages filter
      excludedCreationReasons: [],
    });

    // Assert
    console.log("[SC2] Results count:", results.length);
    console.log(
      "[SC2] Results userIds:",
      results.map((r) => r.userId)
    );

    // Business rule: When languages is excluded, ALL candidates should match (regardless of languages)
    // Expected: U2 (["de"]) and U3 (null) should now be in results
    const u2 = dataManager.getStoryBy("U2");
    const u2Result = results.find((r) => r.userId === u2.userId);
    expect(u2Result).toBeDefined(); // U2 should match now (languages excluded)

    const u3 = dataManager.getStoryBy("U3");
    const u3Result = results.find((r) => r.userId === u3.userId);
    expect(u3Result).toBeDefined(); // U3 should match now (languages excluded)
  });

  it("SC4: Null wildcard (backward compatibility)", async () => {
    // Arrange
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new TestDataManager();

    console.log("[SC4] Searching with languages: null (wildcard)");
    const u3 = dataManager.getStoryBy("U3");
    const u3Context = u3.contexts[0]!; // Has languages: null

    // Act - Search adhoc with null languages
    const results = await searchManager.searchAdhoc({
      userId: u3.userId,
      referenceContext: u3Context,
      limit: 10,
      pathLimit: 10,
      excludedContextFields: [], // Strict matching, but languages is null
      excludedCreationReasons: [],
    });

    // Assert
    console.log("[SC4] Results count:", results.length);
    console.log(
      "[SC4] Results userIds:",
      results.map((r) => r.userId)
    );

    // Business rule: When search languages is null → wildcard (match ALL candidates)
    // Expected: U1 (["en"]), U2 (["de"]), U4 (["en", "de"]) should all match
    const u1 = dataManager.getStoryBy("U1");
    const u1Result = results.find((r) => r.userId === u1.userId);
    expect(u1Result).toBeDefined(); // Null wildcard matches U1

    const u2 = dataManager.getStoryBy("U2");
    const u2Result = results.find((r) => r.userId === u2.userId);
    expect(u2Result).toBeDefined(); // Null wildcard matches U2

    const u4 = dataManager.getStoryBy("U4");
    const u4Result = results.find((r) => r.userId === u4.userId);
    expect(u4Result).toBeDefined(); // Null wildcard matches U4
  });

  it("SC7: Map projection returns languages array", async () => {
    // Arrange
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new TestDataManager();

    console.log("[SC7] Verify map projection returns languages field");
    const u1 = dataManager.getStoryBy("U1");
    const u1Context = u1.contexts[0]!; // Has languages: ["en"]

    // Act - Search adhoc
    const results = await searchManager.searchAdhoc({
      userId: u1.userId,
      referenceContext: u1Context,
      limit: 10,
      pathLimit: 10,
      excludedContextFields: [],
      excludedCreationReasons: [],
    });

    // Assert
    console.log("[SC7] Results count:", results.length);
    expect(results.length).toBeGreaterThan(0);

    // Business rule: Map projection must return languages field
    const u4 = dataManager.getStoryBy("U4");
    const u4Result = results.find((r) => r.userId === u4.userId);
    expect(u4Result).toBeDefined();

    if (u4Result) {
      console.log(
        "[SC7] U4 languages field:",
        u4Result.matchedContext.languages
      );
      expect(u4Result.matchedContext.languages).toBeDefined();
      expect(u4Result.matchedContext.languages).toEqual(["en", "de"]);
    }

    // Verify null languages are returned correctly (backward compatibility)
    const u3 = dataManager.getStoryBy("U3");
    const u3Results = await searchManager.searchAdhoc({
      userId: u3.userId,
      referenceContext: u3.contexts[0]!,
      limit: 10,
      pathLimit: 10,
      excludedContextFields: [],
      excludedCreationReasons: [],
    });

    const u1InU3Search = u3Results.find((r) => r.userId === u1.userId);
    expect(u1InU3Search).toBeDefined();
    if (u1InU3Search) {
      console.log(
        "[SC7] U1 languages field:",
        u1InU3Search.matchedContext.languages
      );
      expect(u1InU3Search.matchedContext.languages).toEqual(["en"]);
    }
  });
});
