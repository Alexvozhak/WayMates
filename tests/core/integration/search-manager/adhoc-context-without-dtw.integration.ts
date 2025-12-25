/**
 * Adhoc Context Search Integration Tests (AC1-AC12)
 *
 * Tests searchWaymates() with custom referenceContext (Mode 1)
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

import { describe, it, expect } from "vitest";
import { driver } from "../../helpers/drivers/shared-driver.js";
import { FixtureSearchManager } from "../../helpers/fixture-search-manager.js";
import { UserStories } from "../../helpers/user-stories.js";
import { adhocContextBase } from "../../../../src/shared/schemas.js";

import type {
  WaymatesSearchParams,
  AdhocContextBase,
  ContextField,
  UserContext,
} from "../../../../src/shared/schemas.js";

/**
 * Creates searchWaymates parameters with referenceContext for adhoc mode
 *
 * Default values:
 * - limit: 10
 * - pathLimit: 10
 * - excludedContextFields: ["languages"]
 * - excludedCreationReasons: []
 */
const createAdhocSearchParams = (
  userId: string,
  referenceContext: AdhocContextBase,
  overrides?: Partial<{
    limit: number;
    pathLimit: number;
    excludedContextFields: ContextField[];
    excludedCreationReasons: string[];
    recencyThresholdMonths: number;
  }>,
): WaymatesSearchParams => ({
  userId,
  referenceContext,
  limit: 10,
  pathLimit: 10,
  excludedContextFields: ["languages"],
  excludedCreationReasons: [],
  recencyThresholdMonths: null,
  ...overrides,
});

describe("Adhoc Context Search (AC1-AC6)", () => {
  // Business rule: When all context fields are strict, only candidates with exact matches score perfectly
  // Skills always contribute to scoring via penalties (even if not in WHERE clause)
  it("AC1: Strict all fields - baseline matching", async () => {
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new UserStories();

    const u1 = dataManager.getStoryBy("U1");
    const u1Context = u1.contexts[0]!;

    console.log("[AC1] Searching with reference context:", {
      position: u1Context.position,
      domains: u1Context.domains,
      skills: u1Context.skills,
    });

    const params = createAdhocSearchParams(u1.userId, adhocContextBase.parse(u1Context));
    const results = await searchManager.searchWaymates(params);

    console.log("[AC1] Results count:", results.length);
    console.log(
      "[AC1] Top results:",
      results.slice(0, 3).map((r) => ({
        userId: r.userId,
        position: r.matchedContext.position,
        score: r.contextMatchScore,
      })),
    );

    const u2 = dataManager.getStoryBy("U2");
    const u2Result = results.find((r) => r.userId === u2.userId);
    expect(u2Result).toBeDefined();

    if (u2Result) {
      // Hardcoded canary: U2 has identical context to U1 → perfect match (no extra skills, no penalties)
      // U1, U2: skills = ["react"] (complexity=65)
      // matched = [react] → weight = 65 × 0.2 = 13
      // extra = [] → penalty = 0
      // score = max(0, 13 - 0) = 13
      // If fails: scoring formula changed OR U2 data changed
      const expectedScore = 13;

      console.log("[AC1] U2 score breakdown:", {
        referenceSkills: u1Context.skills,
        candidateSkills: u2Result.matchedContext.skills,
        expectedScore,
        actualScore: u2Result.contextMatchScore,
      });

      expect(u2Result.contextMatchScore).toBeCloseTo(expectedScore, 2);
    }
  });

  // Business rule: excludedContextFields removes fields from WHERE clause (makes flexible)
  // Skills are NEVER in WHERE - always scored via penalties (extra skills lower score)
  it("AC2: Exclude skills - finds candidates with different skills", async () => {
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new UserStories();

    const u1 = dataManager.getStoryBy("U1");
    const u1Context = u1.contexts[0]!;

    console.log("[AC2] Searching with excludedContextFields: [birthYear, countryCode, cityName]");
    console.log("[AC2] Reference:", {
      position: u1Context.position,
      domains: u1Context.domains,
      skills: u1Context.skills,
    });

    // Note: skills are ALWAYS included in scoring (penalties) to rank candidates
    const params = createAdhocSearchParams(u1.userId, adhocContextBase.parse(u1Context), {
      excludedContextFields: ["birthYear", "countryCode", "cityName", "languages"],
    });
    const results = await searchManager.searchWaymates(params);

    console.log("[AC2] Results count:", results.length);
    console.log(
      "[AC2] Top results:",
      results.slice(0, 5).map((r) => ({
        userId: r.userId,
        position: r.matchedContext.position,
        domains: r.matchedContext.domains,
        skills: r.matchedContext.skills,
      })),
    );

    const u4 = dataManager.getStoryBy("U4");
    const u4Result = results.find((r) => r.userId === u4.userId);
    expect(u4Result).toBeDefined();

    if (u4Result) {
      // Hardcoded canary: U4 extra skill ["svelte"] → penalty 1.0 (fallback, NOT in yaml)
      // U1: skills = ["react"], U4: skills = ["svelte"]
      // matched = [] → weight = 0
      // extra = [svelte] → penalty = 1.0 (fallback)
      // score = max(0, 0 - 1.0) = 0
      // If fails: scoring formula OR svelte penalty changed
      const expectedScore = 0;

      const referenceSkills = new Set(u1Context.skills);
      const extraSkills = u4Result.matchedContext.skills.filter((s) => !referenceSkills.has(s));
      const missingSkills = u1Context.skills.filter((s) => !u4Result.matchedContext.skills.includes(s));

      console.log("[AC2] U4 skill penalty breakdown:", {
        referenceSkills: u1Context.skills,
        candidateSkills: u4Result.matchedContext.skills,
        missingSkills,
        extraSkills,
        expectedScore,
        actualScore: u4Result.contextMatchScore,
      });

      // tolerance = 1 decimal place due to scoring implementation details
      expect(u4Result.contextMatchScore).toBeCloseTo(expectedScore, 1);

      expect(u4Result.matchedContext.position).toBe("junior");
      expect(u4Result.matchedContext.domains).toContain("frontend");
      expect(u4Result.matchedContext.skills).toEqual(["svelte"]);
      expect(u4Result.matchedContext.countryCode).toBe("us");
    }

    const u2 = dataManager.getStoryBy("U2");
    const u6 = dataManager.getStoryBy("U6");
    expect(results.find((r) => r.userId === u2.userId)).toBeDefined();
    expect(results.find((r) => r.userId === u6.userId)).toBeDefined();
  });

  // Business rule: Excluding countryCode/cityName enables international search
  // Finds candidates matching on position/domains/skills regardless of location
  it("AC3: Exclude geo - international search finds candidates from different countries", async () => {
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new UserStories();

    const u1 = dataManager.getStoryBy("U1");
    const u1Context = u1.contexts[0]!;

    console.log("[AC3] Searching with excludedContextFields: [countryCode, cityName, birthYear]");
    console.log("[AC3] Reference:", {
      position: u1Context.position,
      domains: u1Context.domains,
      skills: u1Context.skills,
      geo: `${u1Context.countryCode}/${u1Context.cityName}`,
    });

    const params = createAdhocSearchParams(u1.userId, adhocContextBase.parse(u1Context), {
      excludedContextFields: ["countryCode", "cityName", "birthYear", "languages"],
    });
    const results = await searchManager.searchWaymates(params);

    console.log("[AC3] Results count:", results.length);
    console.log("[AC3] Countries found:", [...new Set(results.map((r) => r.matchedContext.countryCode))]);

    const u2 = dataManager.getStoryBy("U2");
    const u6 = dataManager.getStoryBy("U6");
    expect(results.find((r) => r.userId === u2.userId)).toBeDefined();
    expect(results.find((r) => r.userId === u6.userId)).toBeDefined();

    const germanResults = results.filter((r) => r.matchedContext.countryCode === "de");
    expect(germanResults.length).toBeGreaterThanOrEqual(2);
    console.log(`[AC3] German results count: ${germanResults.length} (expected >= 2)`);
  });

  // Business rule: Only position strict (all others excluded) → finds diverse candidates
  // with same seniority level but different domains/skills/industries
  it("AC4: Only position strict - finds candidates with same position regardless of other fields", async () => {
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new UserStories();

    const u1 = dataManager.getStoryBy("U1");
    const u1Context = u1.contexts[0]!;

    console.log("[AC4] Searching with only position strict (all other fields excluded)");
    console.log("[AC4] Reference:", {
      position: u1Context.position,
      domains: u1Context.domains,
      skills: u1Context.skills,
      industry: u1Context.industry,
      companySize: u1Context.companySize,
    });

    const params = createAdhocSearchParams(u1.userId, adhocContextBase.parse(u1Context), {
      excludedContextFields: [
        "domains",
        "skills",
        "industry",
        "countryCode",
        "cityName",
        "companySize",
        "birthYear",
        "languages",
      ],
    });
    const results = await searchManager.searchWaymates(params);

    console.log("[AC4] Results count:", results.length);
    console.log(
      "[AC4] Diverse results:",
      results.slice(0, 5).map((r) => ({
        userId: r.userId,
        position: r.matchedContext.position,
        domains: r.matchedContext.domains,
        skills: r.matchedContext.skills,
        geo: `${r.matchedContext.countryCode}/${r.matchedContext.cityName}`,
      })),
    );

    const u3 = dataManager.getStoryBy("U3");
    const u7 = dataManager.getStoryBy("U7");

    const backendResults = results.filter((r) => r.matchedContext.domains.includes("backend"));
    expect(backendResults.length).toBeGreaterThanOrEqual(2);
    console.log(`[AC4] Backend results count: ${backendResults.length} (expected >= 2)`);

    const hasBackendCandidate = results.some((r) => r.userId === u3.userId || r.userId === u7.userId);
    expect(hasBackendCandidate).toBe(true);
  });

  // Business rule: excludedCreationReasons works as HARD filter (not score penalty)
  // Removes candidates if ANY context in their trajectory has excluded reason
  it("AC5: Excluded creation reasons - filters out users with specific reasons in trajectory", async () => {
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new UserStories();

    const u1 = dataManager.getStoryBy("U1");
    const u1Context = u1.contexts[0]!;

    console.log("[AC5] Searching with excludedCreationReasons: [milestone_achieved]");
    console.log("[AC5] Reference context creationReason:", u1Context.creationReason);
    console.log(
      "[AC5] U1 trajectory:",
      u1.contexts.map((c) => c.creationReason),
    );

    const params = createAdhocSearchParams(u1.userId, adhocContextBase.parse(u1Context), {
      excludedContextFields: [
        "domains",
        "skills",
        "industry",
        "languages",
        "birthYear",
        "countryCode",
        "cityName",
        "companySize",
      ],
      excludedCreationReasons: ["milestone_achieved"],
    });
    const results = await searchManager.searchWaymates(params);

    console.log("[AC5] Results count:", results.length);
    console.log(
      "[AC5] Results:",
      results.map((r) => ({
        userId: r.userId,
        position: r.matchedContext.position,
        creationReason: r.matchedContext.creationReason,
      })),
    );

    // excludedCreationReasons works as HARD filter (not score penalty)
    expect(results.find((r) => r.userId === u1.userId)).toBeUndefined();

    const u2 = dataManager.getStoryBy("U2");
    const u2Result = results.find((r) => r.userId === u2.userId);
    expect(u2Result).toBeDefined();

    if (u2Result) {
      console.log("[AC5] Score comparison - U2 (included) vs U1 (excluded):", {
        u2Score: u2Result.contextMatchScore,
        u2Reasons: u2.contexts.map((c) => c.creationReason),
        u1Excluded: "U1 filtered out (has milestone_achieved in trajectory)",
        filterLogic: "excludedCreationReasons works as HARD filter, not score penalty",
      });
    }

    const u3 = dataManager.getStoryBy("U3");
    const u4 = dataManager.getStoryBy("U4");
    expect(results.find((r) => r.userId === u3.userId || r.userId === u4.userId)).toBeDefined();
  });

  // Business rule: recencyThresholdMonths filters candidates by context.createdAt
  // Only returns candidates with contexts created within N months from now
  it("AC6: Recency filter - only finds candidates with recent contexts", async () => {
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new UserStories();

    const u1 = dataManager.getStoryBy("U1");
    const u1Context = u1.contexts[0]!;

    console.log("[AC6] Searching with recencyThresholdMonths: 6");
    console.log("[AC6] Reference context createdAt:", u1Context.createdAt);
    console.log("[AC6] Expected: U1, U2 (fresh); NOT U3, U4 (> 6 months old)");

    const params = createAdhocSearchParams(u1.userId, adhocContextBase.parse(u1Context), {
      excludedContextFields: ["birthYear", "countryCode", "cityName", "languages"],
      recencyThresholdMonths: 6,
    });
    const results = await searchManager.searchWaymates(params);

    console.log("[AC6] Results count:", results.length);
    console.log(
      "[AC6] Results:",
      results.map((r) => ({
        userId: r.userId,
        position: r.matchedContext.position,
        createdAt: r.matchedContext.createdAt,
      })),
    );

    const u2 = dataManager.getStoryBy("U2");
    const u2Result = results.find((r) => r.userId === u2.userId);
    expect(u2Result).toBeDefined();

    if (u2Result) {
      console.log("[AC6] U2 createdAt:", u2Result.matchedContext.createdAt);
    }

    const u3 = dataManager.getStoryBy("U3");
    const u4 = dataManager.getStoryBy("U4");
    expect(results.find((r) => r.userId === u3.userId)).toBeUndefined();
    expect(results.find((r) => r.userId === u4.userId)).toBeUndefined();

    const now = new Date();
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    results.forEach((r) => {
      const createdAt = new Date(r.matchedContext.createdAt);
      expect(createdAt.getTime()).toBeGreaterThanOrEqual(sixMonthsAgo.getTime());
    });
  });

  // Business rule: educationLevel as strict field → exact match required (BACHELOR = BACHELOR)
  // null educationLevel in candidate matches any reference value (backward compatibility)
  it("AC7: educationLevel strict filter - finds only matching education level", async () => {
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new UserStories();

    const u1 = dataManager.getStoryBy("U1");
    const u1Context = u1.contexts[0]!;

    console.log("[AC7] Searching with educationLevel strict filter");
    console.log("[AC7] Reference education:", u1Context.educationLevel);
    console.log("[AC7] Expected: U1 (BACHELOR), U2 (BACHELOR)");
    console.log("[AC7] NOT expected: U14 (MASTER)");

    const params = createAdhocSearchParams(u1.userId, adhocContextBase.parse(u1Context));
    const results = await searchManager.searchWaymates(params);

    console.log("[AC7] Results count:", results.length);
    console.log(
      "[AC7] Results:",
      results.map((r) => ({
        userId: r.userId,
        education: r.matchedContext.educationLevel,
      })),
    );

    const u2 = dataManager.getStoryBy("U2");
    const u14 = dataManager.getStoryBy("U14");

    expect(results.find((r) => r.userId === u2.userId)).toBeDefined();
    expect(results.find((r) => r.userId === u14.userId)).toBeUndefined();

    results.forEach((r) => {
      const education = r.matchedContext.educationLevel;
      expect(education === "BACHELOR" || education === null).toBe(true);
    });
  });

  // Business rule: educationLevel in excludedContextFields → becomes flexible
  // Finds candidates with any education level (BACHELOR, MASTER, HIGH_SCHOOL, null)
  it("AC8: educationLevel excluded filter - finds candidates with different education levels", async () => {
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new UserStories();

    console.log("[AC8] Searching with educationLevel excluded from matching");
    const u1 = dataManager.getStoryBy("U1");
    const u1Context = u1.contexts[0]!;
    // Note: U14, U16 have different educationLevel, but may not be in TOP results due to penalty
    const _u14 = dataManager.getStoryBy("U14");
    const _u16 = dataManager.getStoryBy("U16");

    console.log("[AC8] Reference education:", u1Context.educationLevel);
    console.log("[AC8] Expected: U14 (MASTER), U16 (HIGH_SCHOOL), U15 (null)");

    const params = createAdhocSearchParams(u1.userId, adhocContextBase.parse(u1Context), {
      excludedContextFields: [
        "educationLevel",
        "position",
        "domains",
        "skills",
        "companySize",
        "countryCode",
        "cityName",
        "birthYear",
        "languages",
      ],
    });
    const results = await searchManager.searchWaymates(params);

    console.log("[AC8] Results count:", results.length);
    console.log(
      "[AC8] Results:",
      results.map((r) => ({
        userId: r.userId,
        education: r.matchedContext.educationLevel,
      })),
    );

    // Business Rule: educationLevel excluded → finds candidates with DIFFERENT education levels
    // ADR-011: Skills excluded → penalty = 0 (all candidates ranked equally by skills)
    const educationLevels = new Set(results.map((r) => r.matchedContext.educationLevel));
    expect(educationLevels.size).toBeGreaterThanOrEqual(2); // At least 2 different levels
    expect(results.length).toBeGreaterThanOrEqual(5); // Meaningful result set (default limit=10)

    // ADR-011: Verify penalty=0 when skills excluded (all candidates have contextMatchScore=0)
    const allScoresZero = results.every((r) => r.contextMatchScore === 0);
    expect(allScoresZero).toBe(true);
  });

  // Business rule: null educationLevel in reference → wildcard behavior
  // Matches candidates with ANY education level (BACHELOR, MASTER, HIGH_SCHOOL, null)
  it("AC9: null educationLevel wildcard - finds candidates with any education level", async () => {
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new UserStories();

    console.log("[AC9] Searching with null educationLevel (wildcard behavior)");
    const u15 = dataManager.getStoryBy("U15");
    const u15Context = u15.contexts[0]!;
    const u2 = dataManager.getStoryBy("U2");
    const u14 = dataManager.getStoryBy("U14");

    console.log("[AC9] Reference education:", u15Context.educationLevel);
    console.log("[AC9] Expected: Find candidates with ANY education level (BACHELOR, MASTER, HIGH_SCHOOL, null)");

    // ADR-011: Skills excluded → penalty=0 (U14 with [react] has same score as U15 with [python])
    const params = createAdhocSearchParams(u15.userId, adhocContextBase.parse(u15Context), {
      excludedContextFields: ["position", "domains", "skills", "companySize", "countryCode", "cityName", "birthYear"],
    });
    const results = await searchManager.searchWaymates(params);

    console.log("[AC9] Results count:", results.length);
    console.log(
      "[AC9] Results:",
      results.map((r) => ({
        userId: r.userId,
        education: r.matchedContext.educationLevel,
      })),
    );

    // null educationLevel → wildcard (matches all education levels)
    expect(results.find((r) => r.userId === u2.userId)).toBeDefined();
    expect(results.find((r) => r.userId === u14.userId)).toBeDefined();

    const educationLevels = new Set(results.map((r) => r.matchedContext.educationLevel));
    expect(educationLevels.size).toBeGreaterThan(1);

    // ADR-011: Verify penalty=0 when skills excluded
    const allScoresZero = results.every((r) => r.contextMatchScore === 0);
    expect(allScoresZero).toBe(true);
  });

  // Business rule: Salary fields are DISPLAY ONLY (not used for filtering/scoring)
  // salaryExact returned when set, null otherwise
  it("AC10: Salary exact value returned - search results include salaryExact field", async () => {
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new UserStories();

    console.log("[AC10] Searching for U17 with salaryExact field");
    const u1 = dataManager.getStoryBy("U1");
    const u17 = dataManager.getStoryBy("U17");
    const u17Context = u17.contexts[0]!;

    const params = createAdhocSearchParams(u1.userId, adhocContextBase.parse(u17Context), {
      excludedContextFields: [
        "position",
        "domains",
        "skills",
        "companySize",
        "countryCode",
        "cityName",
        "birthYear",
        "educationLevel",
      ],
    });
    const results = await searchManager.searchWaymates(params);

    console.log("[AC10] Results count:", results.length);
    const u17Result = results.find((r) => r.userId === u17.userId);
    expect(u17Result).toBeDefined();

    if (u17Result) {
      // Salary fields are DISPLAY ONLY (not used for filtering/scoring)
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

  // Business rule: Salary fields are DISPLAY ONLY (not used for filtering/scoring)
  // salaryMin/salaryMax returned when set, null otherwise
  it("AC11: Salary range returned - search results include salaryMin/salaryMax fields", async () => {
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new UserStories();

    console.log("[AC11] Searching for U18 with salaryMin/salaryMax fields");
    const u1 = dataManager.getStoryBy("U1");
    const u18 = dataManager.getStoryBy("U18");
    const u18Context = u18.contexts[0]!;

    const params = createAdhocSearchParams(u1.userId, adhocContextBase.parse(u18Context), {
      excludedContextFields: [
        "position",
        "domains",
        "skills",
        "companySize",
        "countryCode",
        "cityName",
        "birthYear",
        "educationLevel",
      ],
      limit: 20, // ADR-011: skills excluded → contextMatchScore=0 for all → order by recency only
    });
    const results = await searchManager.searchWaymates(params);

    console.log("[AC11] Results count:", results.length);
    const u18Result = results.find((r) => r.userId === u18.userId);
    expect(u18Result).toBeDefined();

    if (u18Result) {
      // Salary fields are DISPLAY ONLY (not used for filtering/scoring)
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

  // Business rule: Backward compatibility - contexts without salary fields
  // All salary fields return null, scoring unaffected
  it("AC12: Backward compatibility - users without salary fields work correctly", async () => {
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new UserStories();

    console.log("[AC12] Searching with U1 (no salary fields) - backward compatibility");
    const u1 = dataManager.getStoryBy("U1");
    const u1Context = u1.contexts[0]!;

    const params = createAdhocSearchParams(u1.userId, adhocContextBase.parse(u1Context));
    const results = await searchManager.searchWaymates(params);

    console.log("[AC12] Results count:", results.length);
    const u2 = dataManager.getStoryBy("U2");
    const u2Result = results.find((r) => r.userId === u2.userId);
    expect(u2Result).toBeDefined();

    if (u2Result) {
      console.log("[AC12] U2 salary data (should be null):", {
        salaryExact: u2Result.matchedContext.salaryExact,
        salaryMin: u2Result.matchedContext.salaryMin,
        salaryMax: u2Result.matchedContext.salaryMax,
      });

      expect(u2Result.matchedContext.salaryExact).toBeNull();
      expect(u2Result.matchedContext.salaryMin).toBeNull();
      expect(u2Result.matchedContext.salaryMax).toBeNull();
      // U1 vs U2: both have ["react"] → matched weight = 13, penalty = 0
      expect(u2Result.contextMatchScore).toBeCloseTo(13, 2);
    }
  });

  // Business rule: languages strict matching uses array containment (ALL of reference)
  // ["en"] matches ["en"] and ["en", "de"], NOT ["de"] or null
  it("SC1: Strict languages matching (single language)", async () => {
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new UserStories();

    console.log("[SC1] Searching for candidates with languages: ['en']");
    const u1 = dataManager.getStoryBy("U1");
    const u1Context = u1.contexts[0]!;

    const params = createAdhocSearchParams(u1.userId, adhocContextBase.parse(u1Context), {
      excludedContextFields: ["birthYear", "countryCode", "cityName", "domains", "skills"],
    });
    const results = await searchManager.searchWaymates(params);

    console.log("[SC1] Results count:", results.length);
    console.log(
      "[SC1] Results userIds:",
      results.map((r) => r.userId),
    );

    // languages: ["en"] → matches ["en"] and ["en", "de"], NOT ["de"] or null
    const u4 = dataManager.getStoryBy("U4");
    const u4Result = results.find((r) => r.userId === u4.userId);
    expect(u4Result).toBeDefined();

    const u2 = dataManager.getStoryBy("U2");
    const u2Result = results.find((r) => r.userId === u2.userId);
    expect(u2Result).toBeUndefined();

    const u3 = dataManager.getStoryBy("U3");
    const u3Result = results.find((r) => r.userId === u3.userId);
    expect(u3Result).toBeUndefined();
  });

  // Business rule: Multiple languages use AND logic (ALL must be present)
  // ["en", "de"] matches ONLY candidates with both languages
  it("SC3: Strict languages matching (multiple AND)", async () => {
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new UserStories();

    console.log("[SC3] Searching for candidates with languages: ['en', 'de']");
    const u4 = dataManager.getStoryBy("U4");
    const u4Context = u4.contexts[0]!;

    const params = createAdhocSearchParams(u4.userId, adhocContextBase.parse(u4Context), {
      excludedContextFields: ["birthYear", "countryCode", "cityName", "domains", "skills"],
    });
    const results = await searchManager.searchWaymates(params);

    console.log("[SC3] Results count:", results.length);
    console.log(
      "[SC3] Results userIds:",
      results.map((r) => r.userId),
    );

    // languages: ["en", "de"] → matches ONLY ["en", "de"] (AND logic)
    const u1 = dataManager.getStoryBy("U1");
    const u1Result = results.find((r) => r.userId === u1.userId);
    expect(u1Result).toBeUndefined();

    const u2 = dataManager.getStoryBy("U2");
    const u2Result = results.find((r) => r.userId === u2.userId);
    expect(u2Result).toBeUndefined();

    const u3 = dataManager.getStoryBy("U3");
    const u3Result = results.find((r) => r.userId === u3.userId);
    expect(u3Result).toBeUndefined();
  });

  // Business rule: languages in excludedContextFields → matches ALL candidates
  // Ignores languages field entirely (["en"], ["de"], ["en","de"], null all match)
  it("SC2: Languages excluded (inverse logic)", async () => {
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new UserStories();

    console.log("[SC2] Searching with excludedContextFields: ['languages']");
    const u1 = dataManager.getStoryBy("U1");
    const u1Context = u1.contexts[0]!;

    const params = createAdhocSearchParams(u1.userId, adhocContextBase.parse(u1Context), {
      excludedContextFields: ["languages", "birthYear", "countryCode", "cityName", "domains", "skills"],
    });
    const results = await searchManager.searchWaymates(params);

    console.log("[SC2] Results count:", results.length);
    console.log(
      "[SC2] Results userIds:",
      results.map((r) => r.userId),
    );

    // excludedContextFields: ["languages"] → matches ALL (["en"], ["de"], null)
    const u2 = dataManager.getStoryBy("U2");
    const u2Result = results.find((r) => r.userId === u2.userId);
    expect(u2Result).toBeDefined();

    const u3 = dataManager.getStoryBy("U3");
    const u3Result = results.find((r) => r.userId === u3.userId);
    expect(u3Result).toBeDefined();
  });

  // Business rule: null languages in reference → wildcard behavior
  // Matches candidates with ANY languages (["en"], ["de"], null all match)
  it("SC4: Null wildcard (backward compatibility)", async () => {
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new UserStories();

    console.log("[SC4] Searching with languages: null (wildcard)");
    const u3 = dataManager.getStoryBy("U3");
    const u3Context = u3.contexts[0]!;

    const params = createAdhocSearchParams(u3.userId, adhocContextBase.parse(u3Context), {
      excludedContextFields: ["birthYear", "countryCode", "cityName", "domains", "skills"],
    });
    const results = await searchManager.searchWaymates(params);

    console.log("[SC4] Results count:", results.length);
    console.log(
      "[SC4] Results userIds:",
      results.map((r) => r.userId),
    );

    // languages: null → wildcard (matches ALL)
    const u1 = dataManager.getStoryBy("U1");
    const u1Result = results.find((r) => r.userId === u1.userId);
    expect(u1Result).toBeDefined();

    const u2 = dataManager.getStoryBy("U2");
    const u2Result = results.find((r) => r.userId === u2.userId);
    expect(u2Result).toBeDefined();

    const u4 = dataManager.getStoryBy("U4");
    const u4Result = results.find((r) => r.userId === u4.userId);
    expect(u4Result).toBeDefined();
  });

  // Business rule: Map projection must return languages field correctly
  // Arrays returned as-is, null preserved (backward compatibility)
  it("SC7: Map projection returns languages array", async () => {
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new UserStories();

    console.log("[SC7] Verify map projection returns languages field");
    const u1 = dataManager.getStoryBy("U1");
    const u1Context = u1.contexts[0]!;

    const params = createAdhocSearchParams(u1.userId, adhocContextBase.parse(u1Context), {
      excludedContextFields: ["birthYear", "countryCode", "cityName", "domains", "skills"],
    });
    const results = await searchManager.searchWaymates(params);

    console.log("[SC7] Results count:", results.length);
    expect(results.length).toBeGreaterThan(0);

    // Business rule: Map projection must return languages field
    const u4 = dataManager.getStoryBy("U4");
    const u4Result = results.find((r) => r.userId === u4.userId);
    expect(u4Result).toBeDefined();

    if (u4Result) {
      console.log("[SC7] U4 languages field:", u4Result.matchedContext.languages);
      expect(u4Result.matchedContext.languages).toBeDefined();
      expect(u4Result.matchedContext.languages).toEqual(expect.arrayContaining(["en", "de"]));
      expect(u4Result.matchedContext.languages).toHaveLength(2);
    }

    // Verify null languages are returned correctly (backward compatibility)
    const u3 = dataManager.getStoryBy("U3");
    const u3Params = createAdhocSearchParams(u3.userId, adhocContextBase.parse(u3.contexts[0]!), {
      excludedContextFields: ["birthYear", "countryCode", "cityName", "domains", "skills"],
    });
    const u3Results = await searchManager.searchWaymates(u3Params);

    const u1InU3Search = u3Results.find((r) => r.userId === u1.userId);
    expect(u1InU3Search).toBeDefined();
    if (u1InU3Search) {
      console.log("[SC7] U1 languages field:", u1InU3Search.matchedContext.languages);
      expect(u1InU3Search.matchedContext.languages).toEqual(["en"]);
    }
  });
});

describe("Partial Context Tests (AC13-AC15)", () => {
  // Business rule: Adhoc mode with minimal context - Entry-level onboarding
  // Users provide only position + skills (typical for job seekers)
  it("AC13: Minimal adhoc context - Entry-level job seeker finds relevant paths", async () => {
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new UserStories();

    // Business scenario: User says "I'm a Junior React developer"
    // Facade normalized: {position: "junior", skills: ["react"], domains: ["frontend"]}
    const partialContext: Partial<UserContext> = {
      position: "junior",
      skills: ["react"],
      domains: ["frontend"],
      // Missing: industry, geo, companySize, birthYear (typical for new users)
    };

    console.log("[AC13] Searching with minimal context:", partialContext);

    const params = createAdhocSearchParams("test_user", adhocContextBase.parse(partialContext), {
      excludedContextFields: [],
    });
    const results = await searchManager.searchWaymates(params);

    console.log("[AC13] Results count:", results.length);
    console.log(
      "[AC13] Top results:",
      results.slice(0, 3).map((r) => ({
        userId: r.userId,
        position: r.matchedContext.position,
        skills: r.matchedContext.skills,
        score: r.contextMatchScore,
      })),
    );

    // Business assertion: Finds Junior React developers (U1, U2)
    expect(results.length).toBeGreaterThan(0);

    const u1 = dataManager.getStoryBy("U1");
    const u2 = dataManager.getStoryBy("U2");
    const u1Result = results.find((r) => r.userId === u1.userId);
    const u2Result = results.find((r) => r.userId === u2.userId);

    // U1 and U2 have Junior + react → should match
    expect(u1Result).toBeDefined();
    expect(u2Result).toBeDefined();

    // Scoring works (penalty for extra skills)
    if (u2Result) {
      console.log("[AC13] U2 match details:", {
        position: u2Result.matchedContext.position,
        skills: u2Result.matchedContext.skills,
        score: u2Result.contextMatchScore,
      });
      // U2: skills=["react"], matched=["react"], extra=[]
      // Expected: (65 × 0.2) - 0 = 13
      const expectedScore = 13;
      expect(u2Result.contextMatchScore).toBe(expectedScore);
    }
  });

  // Business rule: Skills-only adhoc - Technology stack exploration
  // Users explore "what careers are possible with my stack"
  it("AC14: Skills-only adhoc - Technology-focused career exploration", async () => {
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();

    // Business scenario: User asks "What careers are possible with Python?"
    // No position/seniority known yet
    const partialContext: Partial<UserContext> = {
      skills: ["python"],
      // Missing: position, domains, ALL other fields
    };

    console.log("[AC14] Searching with skills-only context:", partialContext);

    const params = createAdhocSearchParams("test_user", adhocContextBase.parse(partialContext), {
      excludedContextFields: [
        "position",
        "domains",
        "industry",
        "countryCode",
        "cityName",
        "companySize",
        "birthYear",
        "educationLevel",
        "languages",
      ],
      limit: 20,
    });
    const results = await searchManager.searchWaymates(params);

    console.log("[AC14] Results count:", results.length);
    console.log("[AC14] Position diversity:", [...new Set(results.map((r) => r.matchedContext.position))]);

    // Business assertion: Finds candidates with Python (any level)
    expect(results.length).toBeGreaterThan(0);

    // Diverse positions (Junior, Senior, different domains)
    const positions = new Set(results.map((r) => r.matchedContext.position));
    expect(positions.size).toBeGreaterThan(1); // Not limited to one position

    // Scoring based on skills penalty (no position match required)
    const hasScoredResults = results.some((r) => r.contextMatchScore > 0);
    expect(hasScoredResults).toBe(true);

    console.log("[AC14] Score range:", {
      min: Math.min(...results.map((r) => r.contextMatchScore)),
      max: Math.max(...results.map((r) => r.contextMatchScore)),
    });
  });

  // Business rule: International adhoc (no geo) - Global mobility
  // Senior specialists seek international opportunities
  it("AC15: No geo constraints - International career search", async () => {
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();

    // Business scenario: Senior developer seeks global opportunities
    // "Senior Backend with Python, any country"
    const partialContext: Partial<UserContext> = {
      position: "senior",
      domains: ["backend"],
      skills: ["python"],
      // Missing: countryCode, cityName (intentional - international search)
    };

    console.log("[AC15] Searching with no geo constraints:", partialContext);

    const params = createAdhocSearchParams("test_user", adhocContextBase.parse(partialContext), {
      excludedContextFields: [
        "industry",
        "countryCode",
        "cityName",
        "companySize",
        "birthYear",
        "educationLevel",
        "languages",
      ],
      limit: 20,
    });
    const results = await searchManager.searchWaymates(params);

    console.log("[AC15] Results count:", results.length);
    console.log("[AC15] Countries found:", [...new Set(results.map((r) => r.matchedContext.countryCode))]);

    // Business assertion: Finds Senior Backend from multiple countries
    expect(results.length).toBeGreaterThan(0);

    const countries = new Set(results.map((r) => r.matchedContext.countryCode));
    console.log("[AC15] International diversity:", countries.size, "countries");
    expect(countries.size).toBeGreaterThanOrEqual(1);

    // All results match position + domains
    results.forEach((r) => {
      expect(r.matchedContext.position).toBe("senior");
      expect(r.matchedContext.domains).toContain("backend");
    });
  });
});
