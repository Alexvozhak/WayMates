/**
 * Target Search Integration Tests (TG1-TG7, TG-LANG, TG-IND, TG-CITY, TG-CIT, TG-EDU)
 *
 * Tests reverseSearchPathfinders() with FieldFilter modes (desired/undesired)
 * Uses Batch A+B test data (U1-U19) from globalSetup
 *
 * Test focus:
 * - TG1: Desired position (include specific position)
 * - TG2: Undesired position (exclude specific position)
 * - TG3: Desired domains (ANY match)
 * - TG4: Undesired domains (NONE match)
 * - TG5: Desired skills (ANY match)
 * - TG6: Undesired skills (NONE match)
 * - TG7: Combined filters (position + domains + skills)
 * - TG-LANG-1/2: Languages filter (desired/undesired)
 * - TG-IND-1/2: Industries filter (finance → U7)
 * - TG-CITY-1/2: Cities filter (berlin → U1/U2/U5/U6/U9/U14)
 * - TG-CIT-1/2: Citizenships filter (de → U1/U5/U6/U9/U14, ru → exclude U10-U13/U19)
 * - TG-EDU-1/2: EducationLevels filter (MASTER → U14/U18)
 */

import { targetContextSchema, targetSearchParamsSchema } from "@shared/schemas.js";
import { describe, expect, it } from "vitest";

import { driver } from "../../helpers/drivers/shared-driver.js";
import { FixtureSearchManager } from "../../helpers/fixture-search-manager.js";
import { validateAllPaths } from "../../helpers/path-validator.js";
import { UserStories } from "../../helpers/user-stories.js";

import type { TargetContext, UserId } from "@shared/schemas.js";

const createTargetParams = (userId: UserId, targetContext: TargetContext) =>
  targetSearchParamsSchema.parse({
    userId,
    targetContext,
    excludedCreationReasons: [],
    recencyThresholdMonths: null,
    limit: 20,
  });

describe("Target Search (TG1-TG7, TG-LANG, TG-IND, TG-CITY, TG-CIT, TG-EDU)", () => {
  // Business rule: Desired position filter matches ONLY candidates with exact position.
  // Target search scans ALL contexts (historical + current) to find who reached target.
  it("TG1: Desired position - finds only candidates with specified position", async () => {
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new UserStories();
    const u3 = dataManager.getStoryBy("U3");

    console.log("[TG1] Searching for position: Middle (desired mode)");

    const results = await searchManager.reverseSearchPathfinders(
      createTargetParams(
        u3.userId,
        targetContextSchema.parse({
          position: {
            mode: "desired",
            values: ["middle"],
          },
        }),
      ),
    );

    console.log("[TG1] Results count:", results.length);
    console.log(
      "[TG1] Matched users:",
      results.map((r) => ({
        userId: r.userId,
        position: r.matchedContext.position,
        domains: r.matchedContext.domains,
      })),
    );

    const u5 = dataManager.getStoryBy("U5");
    const hasU5 = results.some((r) => r.userId === u5.userId);
    expect(hasU5).toBe(true);

    results.forEach((r) => {
      expect(r.matchedContext.position).toBe("middle");
    });

    validateAllPaths(results, "TG1");
  });

  // Business rule: Undesired position excludes ALL candidates with that position in ANY context.
  // Note: Users with trajectories (Junior → Middle) will still match via their Middle context.
  it("TG2: Undesired position - excludes candidates with specified position", async () => {
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new UserStories();
    const u3 = dataManager.getStoryBy("U3");

    console.log("[TG2] Excluding position: Junior (undesired mode)");

    const results = await searchManager.reverseSearchPathfinders(
      createTargetParams(
        u3.userId,
        targetContextSchema.parse({
          position: {
            mode: "undesired",
            values: ["junior"],
          },
        }),
      ),
    );

    console.log("[TG2] Results count:", results.length);
    console.log(
      "[TG2] Matched positions:",
      results.map((r) => r.matchedContext.position),
    );

    const u5 = dataManager.getStoryBy("U5");
    const hasU5 = results.some((r) => r.userId === u5.userId);
    expect(hasU5).toBe(true);

    results.forEach((r) => {
      expect(r.matchedContext.position).not.toBe("junior");
    });

    const u4 = dataManager.getStoryBy("U4");
    const u7 = dataManager.getStoryBy("U7");

    expect(results.find((r) => r.userId === u4.userId)).toBeUndefined();
    expect(results.find((r) => r.userId === u7.userId)).toBeUndefined();

    validateAllPaths(results, "TG2");
  });

  // Business rule: Desired domains filter uses ANY match (OR logic) - at least one domain must match.
  it("TG3: Desired domains - finds candidates with ANY matching domain", async () => {
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new UserStories();
    const u3 = dataManager.getStoryBy("U3");

    console.log("[TG3] Searching for domains: Frontend (desired mode)");

    const results = await searchManager.reverseSearchPathfinders(
      createTargetParams(
        u3.userId,
        targetContextSchema.parse({
          domains: {
            mode: "desired",
            values: ["frontend"],
          },
        }),
      ),
    );

    console.log("[TG3] Results count:", results.length);
    console.log(
      "[TG3] Sample results:",
      results.slice(0, 3).map((r) => ({
        userId: r.userId,
        position: r.matchedContext.position,
        domains: r.matchedContext.domains,
      })),
    );

    const frontendUsers = ["U1", "U2", "U4", "U5", "U6", "U9", "U12"] as const;
    const frontendUserIds = frontendUsers.map((key) => dataManager.getStoryBy(key).userId);

    const matchedUserIds = new Set(results.map((r) => r.userId));
    const hasFrontendUsers = frontendUserIds.some((id) => matchedUserIds.has(id));
    expect(hasFrontendUsers).toBe(true);

    results.forEach((r) => {
      expect(r.matchedContext.domains).toContain("frontend");
    });

    const u7 = dataManager.getStoryBy("U7");
    const u8 = dataManager.getStoryBy("U8");
    expect(results.find((r) => r.userId === u7.userId)).toBeUndefined();
    expect(results.find((r) => r.userId === u8.userId)).toBeUndefined();

    validateAllPaths(results, "TG3");
  });

  // Business rule: Undesired domains filter uses NONE match - excludes if ANY domain matches.
  it("TG4: Undesired domains - excludes candidates with ANY matching domain", async () => {
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new UserStories();
    const u3 = dataManager.getStoryBy("U3");

    console.log("[TG4] Excluding domains: Frontend (undesired mode)");

    const results = await searchManager.reverseSearchPathfinders(
      createTargetParams(
        u3.userId,
        targetContextSchema.parse({
          domains: {
            mode: "undesired",
            values: ["frontend"],
          },
        }),
      ),
    );

    console.log("[TG4] Results count:", results.length);
    console.log(
      "[TG4] Matched domains:",
      results.map((r) => r.matchedContext.domains),
    );

    const backendUsers = ["U7", "U8", "U10", "U11"] as const;
    const backendUserIds = backendUsers.map((key) => dataManager.getStoryBy(key).userId);

    const matchedUserIds = new Set(results.map((r) => r.userId));
    const hasBackendUsers = backendUserIds.some((id) => matchedUserIds.has(id));
    expect(hasBackendUsers).toBe(true);

    results.forEach((r) => {
      expect(r.matchedContext.domains).not.toContain("frontend");
    });

    const u1 = dataManager.getStoryBy("U1");
    const u2 = dataManager.getStoryBy("U2");
    const u4 = dataManager.getStoryBy("U4");
    expect(results.find((r) => r.userId === u1.userId)).toBeUndefined();
    expect(results.find((r) => r.userId === u2.userId)).toBeUndefined();
    expect(results.find((r) => r.userId === u4.userId)).toBeUndefined();

    validateAllPaths(results, "TG4");
  });

  // Business rule: Desired skills filter uses ANY match (OR logic) - at least one skill must match.
  it("TG5: Desired skills - finds candidates with ANY matching skill", async () => {
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new UserStories();
    const u3 = dataManager.getStoryBy("U3");

    console.log("[TG5] Searching for skills: python (desired mode)");

    const results = await searchManager.reverseSearchPathfinders(
      createTargetParams(
        u3.userId,
        targetContextSchema.parse({
          skills: {
            mode: "desired",
            values: ["python"],
          },
        }),
      ),
    );

    console.log("[TG5] Results count:", results.length);
    console.log(
      "[TG5] Sample skills:",
      results.slice(0, 3).map((r) => ({
        userId: r.userId,
        skills: r.matchedContext.skills.slice(0, 3),
      })),
    );

    const pythonUsers = ["U8", "U11", "U13"] as const;
    const pythonUserIds = pythonUsers.map((key) => dataManager.getStoryBy(key).userId);

    const matchedUserIds = new Set(results.map((r) => r.userId));
    const hasPythonUsers = pythonUserIds.some((id) => matchedUserIds.has(id));
    expect(hasPythonUsers).toBe(true);

    results.forEach((r) => {
      expect(r.matchedContext.skills).toContain("python");
    });

    const u1 = dataManager.getStoryBy("U1");
    const u2 = dataManager.getStoryBy("U2");
    expect(results.find((r) => r.userId === u1.userId)).toBeUndefined();
    expect(results.find((r) => r.userId === u2.userId)).toBeUndefined();

    validateAllPaths(results, "TG5");
  });

  // Business rule: Undesired skills filter uses NONE match - excludes if ANY skill matches.
  it("TG6: Undesired skills - excludes candidates with ANY matching skill", async () => {
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new UserStories();
    const u3 = dataManager.getStoryBy("U3");

    console.log("[TG6] Excluding skills: python (undesired mode)");

    const results = await searchManager.reverseSearchPathfinders(
      createTargetParams(
        u3.userId,
        targetContextSchema.parse({
          skills: {
            mode: "undesired",
            values: ["python"],
          },
        }),
      ),
    );

    console.log("[TG6] Results count:", results.length);
    console.log(
      "[TG6] Sample users without python:",
      results.slice(0, 3).map((r) => ({
        userId: r.userId,
        skills: r.matchedContext.skills.slice(0, 3),
      })),
    );

    const nonPythonUsers = ["U1", "U2", "U4", "U5", "U6", "U7", "U9", "U10", "U12"] as const;
    const nonPythonUserIds = nonPythonUsers.map((key) => dataManager.getStoryBy(key).userId);

    const matchedUserIds = new Set(results.map((r) => r.userId));
    const hasNonPythonUsers = nonPythonUserIds.some((id) => matchedUserIds.has(id));
    expect(hasNonPythonUsers).toBe(true);

    results.forEach((r) => {
      expect(r.matchedContext.skills).not.toContain("python");
    });

    const u8 = dataManager.getStoryBy("U8");
    const u11 = dataManager.getStoryBy("U11");
    const u13 = dataManager.getStoryBy("U13");
    expect(results.find((r) => r.userId === u8.userId)).toBeUndefined();
    expect(results.find((r) => r.userId === u11.userId)).toBeUndefined();
    expect(results.find((r) => r.userId === u13.userId)).toBeUndefined();

    validateAllPaths(results, "TG6");
  });

  // Business rule: Combined filters use AND logic - ALL criteria must be satisfied.
  it("TG7: Combined filters - position + domains + skills", async () => {
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new UserStories();
    const u3 = dataManager.getStoryBy("U3");

    console.log("[TG7] Combined: Junior + Backend + NOT python");

    const results = await searchManager.reverseSearchPathfinders(
      createTargetParams(
        u3.userId,
        targetContextSchema.parse({
          position: {
            mode: "desired",
            values: ["junior"],
          },
          domains: {
            mode: "desired",
            values: ["backend"],
          },
          skills: {
            mode: "undesired",
            values: ["python"],
          },
        }),
      ),
    );

    console.log("[TG7] Results count:", results.length);
    console.log(
      "[TG7] Matched users:",
      results.map((r) => ({
        userId: r.userId,
        position: r.matchedContext.position,
        domains: r.matchedContext.domains,
        skills: r.matchedContext.skills.slice(0, 2),
      })),
    );

    const u7 = dataManager.getStoryBy("U7");
    const u10 = dataManager.getStoryBy("U10");

    const hasU7 = results.some((r) => r.userId === u7.userId);
    const hasU10 = results.some((r) => r.userId === u10.userId);

    expect(hasU7 || hasU10).toBe(true);

    results.forEach((r) => {
      expect(r.matchedContext.position).toBe("junior");
      expect(r.matchedContext.domains).toContain("backend");
      expect(r.matchedContext.skills).not.toContain("python");
    });

    const u8 = dataManager.getStoryBy("U8");
    const u11 = dataManager.getStoryBy("U11");
    const u1 = dataManager.getStoryBy("U1");

    expect(results.find((r) => r.userId === u8.userId)).toBeUndefined();
    expect(results.find((r) => r.userId === u11.userId)).toBeUndefined();
    expect(results.find((r) => r.userId === u1.userId)).toBeUndefined();

    validateAllPaths(results, "TG7");
  });

  // Business rule: Desired languages filter uses ANY match (OR logic) - at least one language must match.
  it("TG-LANG-1: Desired languages - finds candidates with ANY specified language (OR logic)", async () => {
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new UserStories();

    console.log("[TG-LANG-1] Searching for languages: ['en', 'fr'] (desired mode, OR logic)");
    const u3 = dataManager.getStoryBy("U3");

    const results = await searchManager.reverseSearchPathfinders(
      createTargetParams(
        u3.userId,
        targetContextSchema.parse({
          languages: {
            mode: "desired",
            values: ["EN", "FR"],
          },
        }),
      ),
    );

    console.log("[TG-LANG-1] Results count:", results.length);
    console.log(
      "[TG-LANG-1] Matched users:",
      results.map((r) => ({
        userId: r.userId,
        languages: r.matchedContext.languages,
      })),
    );

    const u1 = dataManager.getStoryBy("U1");
    const u4 = dataManager.getStoryBy("U4");
    const u2 = dataManager.getStoryBy("U2");

    const hasU1 = results.some((r) => r.userId === u1.userId);
    const hasU4 = results.some((r) => r.userId === u4.userId);
    const hasU2 = results.some((r) => r.userId === u2.userId);

    expect(hasU1).toBe(true);
    expect(hasU4).toBe(true);
    expect(hasU2).toBe(false);

    results.forEach((r) => {
      const languages = r.matchedContext.languages || [];
      const hasMatch = languages.some((lang) => ["EN", "FR"].includes(lang));
      expect(hasMatch).toBe(true);
    });

    validateAllPaths(results, "TG-LANG-1");
  });

  // Business rule: Undesired languages filter uses NONE match - excludes if ANY language matches.
  it("TG-LANG-2: Undesired languages - excludes candidates with ANY specified language (NONE logic)", async () => {
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new UserStories();

    console.log("[TG-LANG-2] Searching for undesired languages: ['en'] (exclude ALL with 'en')");
    const u3 = dataManager.getStoryBy("U3");

    const results = await searchManager.reverseSearchPathfinders(
      createTargetParams(
        u3.userId,
        targetContextSchema.parse({
          languages: {
            mode: "undesired",
            values: ["EN"],
          },
        }),
      ),
    );

    console.log("[TG-LANG-2] Results count:", results.length);
    console.log(
      "[TG-LANG-2] Matched users:",
      results.map((r) => ({
        userId: r.userId,
        languages: r.matchedContext.languages,
      })),
    );

    const u1 = dataManager.getStoryBy("U1");
    const u4 = dataManager.getStoryBy("U4");
    const u2 = dataManager.getStoryBy("U2");

    const hasU1 = results.some((r) => r.userId === u1.userId);
    const hasU4 = results.some((r) => r.userId === u4.userId);
    const hasU2 = results.some((r) => r.userId === u2.userId);

    expect(hasU1).toBe(false);
    expect(hasU4).toBe(false);
    expect(hasU2).toBe(true);

    results.forEach((r) => {
      const languages = r.matchedContext.languages || [];
      const hasEn = languages.includes("EN");
      expect(hasEn).toBe(false);
    });

    validateAllPaths(results, "TG-LANG-2");
  });

  /**
   * TG-IND-1: Desired industries filter (ANY match)
   *
   * Given:
   * - Target with industries: { mode: "desired", values: ["finance"] }
   * - U7 has industry: "finance", others have "tech" or "IT"
   *
   * Then:
   * - Only U7 is returned (only finance user)
   * - All results have industry = "finance"
   *
   * Business rule: Desired industries uses ANY match (OR logic)
   */
  it("TG-IND-1: Desired industries - finds candidates with specified industry", async () => {
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new UserStories();
    const u3 = dataManager.getStoryBy("U3");

    console.log("[TG-IND-1] Searching for industries: finance (desired mode)");

    const results = await searchManager.reverseSearchPathfinders(
      createTargetParams(
        u3.userId,
        targetContextSchema.parse({
          industries: {
            mode: "desired",
            values: ["finance"],
          },
        }),
      ),
    );

    console.log("[TG-IND-1] Results count:", results.length);
    console.log(
      "[TG-IND-1] Matched users:",
      results.map((r) => ({
        userId: r.userId,
        industry: r.matchedContext.industry,
      })),
    );

    const u7 = dataManager.getStoryBy("U7");
    const hasU7 = results.some((r) => r.userId === u7.userId);
    expect(hasU7).toBe(true);

    results.forEach((r) => {
      expect(r.matchedContext.industry).toBe("finance");
    });

    validateAllPaths(results, "TG-IND-1");
  });

  /**
   * TG-IND-2: Undesired industries filter (NONE match)
   *
   * Given:
   * - Target with industries: { mode: "undesired", values: ["finance"] }
   * - U7 has industry: "finance"
   *
   * Then:
   * - U7 is NOT in results
   * - All results have industry != "finance"
   *
   * Business rule: Undesired industries excludes ALL with that industry
   */
  it("TG-IND-2: Undesired industries - excludes candidates with specified industry", async () => {
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new UserStories();
    const u3 = dataManager.getStoryBy("U3");

    console.log("[TG-IND-2] Excluding industries: finance (undesired mode)");

    const results = await searchManager.reverseSearchPathfinders(
      createTargetParams(
        u3.userId,
        targetContextSchema.parse({
          industries: {
            mode: "undesired",
            values: ["finance"],
          },
        }),
      ),
    );

    console.log("[TG-IND-2] Results count:", results.length);

    const u7 = dataManager.getStoryBy("U7");
    expect(results.find((r) => r.userId === u7.userId)).toBeUndefined();

    results.forEach((r) => {
      expect(r.matchedContext.industry).not.toBe("finance");
    });

    validateAllPaths(results, "TG-IND-2");
  });

  /**
   * TG-CITY-1: Desired cities filter (ANY match)
   *
   * Given:
   * - Target with cities: { mode: "desired", values: ["berlin"] }
   * - U1, U2, U5, U6, U9, U14 have cityName: "berlin"
   *
   * Then:
   * - Berlin users are in results
   * - All results have cityName = "berlin"
   *
   * Business rule: Desired cities uses ANY match (OR logic)
   */
  it("TG-CITY-1: Desired cities - finds candidates in specified city", async () => {
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new UserStories();
    const u3 = dataManager.getStoryBy("U3");

    console.log("[TG-CITY-1] Searching for cities: berlin (desired mode)");

    const results = await searchManager.reverseSearchPathfinders(
      createTargetParams(
        u3.userId,
        targetContextSchema.parse({
          cities: {
            mode: "desired",
            values: ["berlin"],
          },
        }),
      ),
    );

    console.log("[TG-CITY-1] Results count:", results.length);
    console.log(
      "[TG-CITY-1] Matched users:",
      results.map((r) => ({
        userId: r.userId,
        cityName: r.matchedContext.cityName,
      })),
    );

    const berlinUsers = ["U1", "U2", "U5", "U6", "U9", "U14"] as const;
    const berlinUserIds = berlinUsers.map((key) => dataManager.getStoryBy(key).userId);
    const matchedUserIds = new Set(results.map((r) => r.userId));
    const hasBerlinUsers = berlinUserIds.some((id) => matchedUserIds.has(id));
    expect(hasBerlinUsers).toBe(true);

    results.forEach((r) => {
      expect(r.matchedContext.cityName).toBe("berlin");
    });

    validateAllPaths(results, "TG-CITY-1");
  });

  /**
   * TG-CITY-2: Undesired cities filter (NONE match)
   *
   * Given:
   * - Target with cities: { mode: "undesired", values: ["berlin"] }
   * - U1, U2, U5, U6, U14 have ONLY berlin contexts
   * - U9 has berlin + munich contexts (found via munich)
   *
   * Then:
   * - Users with ONLY berlin contexts are NOT in results
   * - All matchedContext.cityName != "berlin"
   *
   * Business rule: Undesired cities excludes contexts with that city,
   * but users with other city contexts can still be found via those contexts.
   */
  it("TG-CITY-2: Undesired cities - excludes candidates in specified city", async () => {
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new UserStories();
    const u3 = dataManager.getStoryBy("U3");

    console.log("[TG-CITY-2] Excluding cities: berlin (undesired mode)");

    const results = await searchManager.reverseSearchPathfinders(
      createTargetParams(
        u3.userId,
        targetContextSchema.parse({
          cities: {
            mode: "undesired",
            values: ["berlin"],
          },
        }),
      ),
    );

    console.log("[TG-CITY-2] Results count:", results.length);

    // Users with ONLY berlin contexts should be excluded
    // Note: U9 has berlin + munich contexts, can be found via munich
    const berlinOnlyUsers = ["U1", "U2", "U5", "U6", "U14"] as const;
    berlinOnlyUsers.forEach((key) => {
      const user = dataManager.getStoryBy(key);
      expect(results.find((r) => r.userId === user.userId)).toBeUndefined();
    });

    // All matched contexts should NOT be berlin
    results.forEach((r) => {
      expect(r.matchedContext.cityName).not.toBe("berlin");
    });

    validateAllPaths(results, "TG-CITY-2");
  });

  /**
   * TG-CIT-1: Desired citizenships filter (ANY match)
   *
   * Given:
   * - Target with citizenships: { mode: "desired", values: ["de"] }
   * - U1, U5, U6, U9, U14 have citizenships: ["de"]
   *
   * Then:
   * - German citizens are in results
   * - All results have "de" in citizenships
   *
   * Business rule: Desired citizenships uses ANY match (OR logic)
   */
  it("TG-CIT-1: Desired citizenships - finds candidates with specified citizenship", async () => {
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new UserStories();
    const u3 = dataManager.getStoryBy("U3");

    console.log("[TG-CIT-1] Searching for citizenships: de (desired mode)");

    const results = await searchManager.reverseSearchPathfinders(
      createTargetParams(
        u3.userId,
        targetContextSchema.parse({
          citizenships: {
            mode: "desired",
            values: ["DE"],
          },
        }),
      ),
    );

    console.log("[TG-CIT-1] Results count:", results.length);
    console.log(
      "[TG-CIT-1] Matched users:",
      results.map((r) => ({
        userId: r.userId,
        citizenships: r.matchedContext.citizenships,
      })),
    );

    const deUsers = ["U1", "U5", "U6", "U9", "U14"] as const;
    const deUserIds = deUsers.map((key) => dataManager.getStoryBy(key).userId);
    const matchedUserIds = new Set(results.map((r) => r.userId));
    const hasDeUsers = deUserIds.some((id) => matchedUserIds.has(id));
    expect(hasDeUsers).toBe(true);

    results.forEach((r) => {
      expect(r.matchedContext.citizenships).toContain("DE");
    });

    validateAllPaths(results, "TG-CIT-1");
  });

  /**
   * TG-CIT-2: Undesired citizenships filter (NONE match)
   *
   * Given:
   * - Target with citizenships: { mode: "undesired", values: ["ru"] }
   * - U10, U11, U12, U13, U19 have citizenships: ["ru"]
   *
   * Then:
   * - Russian citizens are NOT in results
   * - No results have "ru" in citizenships
   *
   * Business rule: Undesired citizenships excludes ALL with that citizenship
   */
  it("TG-CIT-2: Undesired citizenships - excludes candidates with specified citizenship", async () => {
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new UserStories();
    const u3 = dataManager.getStoryBy("U3");

    console.log("[TG-CIT-2] Excluding citizenships: ru (undesired mode)");

    const results = await searchManager.reverseSearchPathfinders(
      createTargetParams(
        u3.userId,
        targetContextSchema.parse({
          citizenships: {
            mode: "undesired",
            values: ["RU"],
          },
        }),
      ),
    );

    console.log("[TG-CIT-2] Results count:", results.length);

    const ruUsers = ["U10", "U11", "U12", "U13", "U19"] as const;
    ruUsers.forEach((key) => {
      const user = dataManager.getStoryBy(key);
      expect(results.find((r) => r.userId === user.userId)).toBeUndefined();
    });

    results.forEach((r) => {
      const citizenships = r.matchedContext.citizenships || [];
      expect(citizenships).not.toContain("RU");
    });

    validateAllPaths(results, "TG-CIT-2");
  });

  /**
   * TG-EDU-1: Desired educationLevels filter (ANY match)
   *
   * Given:
   * - Target with educationLevels: { mode: "desired", values: ["MASTER"] }
   * - U14, U18 have educationLevel: "MASTER"
   *
   * Then:
   * - Users with MASTER are in results
   * - All results have educationLevel = "MASTER"
   *
   * Business rule: Desired educationLevels uses ANY match (OR logic)
   */
  it("TG-EDU-1: Desired educationLevels - finds candidates with specified education", async () => {
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new UserStories();
    const u3 = dataManager.getStoryBy("U3");

    console.log("[TG-EDU-1] Searching for educationLevels: MASTER (desired mode)");

    const results = await searchManager.reverseSearchPathfinders(
      createTargetParams(
        u3.userId,
        targetContextSchema.parse({
          educationLevels: {
            mode: "desired",
            values: ["MASTER"],
          },
        }),
      ),
    );

    console.log("[TG-EDU-1] Results count:", results.length);
    console.log(
      "[TG-EDU-1] Matched users:",
      results.map((r) => ({
        userId: r.userId,
        educationLevel: r.matchedContext.educationLevel,
      })),
    );

    const masterUsers = ["U14", "U18"] as const;
    const masterUserIds = masterUsers.map((key) => dataManager.getStoryBy(key).userId);
    const matchedUserIds = new Set(results.map((r) => r.userId));
    const hasMasterUsers = masterUserIds.some((id) => matchedUserIds.has(id));
    expect(hasMasterUsers).toBe(true);

    results.forEach((r) => {
      expect(r.matchedContext.educationLevel).toBe("MASTER");
    });

    validateAllPaths(results, "TG-EDU-1");
  });

  /**
   * TG-EDU-2: Undesired educationLevels filter (NONE match)
   *
   * Given:
   * - Target with educationLevels: { mode: "undesired", values: ["MASTER"] }
   * - U14, U18 have educationLevel: "MASTER"
   *
   * Then:
   * - Users with MASTER are NOT in results
   * - All results have educationLevel != "MASTER"
   *
   * Business rule: Undesired educationLevels excludes ALL with that level
   */
  it("TG-EDU-2: Undesired educationLevels - excludes candidates with specified education", async () => {
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new UserStories();
    const u3 = dataManager.getStoryBy("U3");

    console.log("[TG-EDU-2] Excluding educationLevels: MASTER (undesired mode)");

    const results = await searchManager.reverseSearchPathfinders(
      createTargetParams(
        u3.userId,
        targetContextSchema.parse({
          educationLevels: {
            mode: "undesired",
            values: ["MASTER"],
          },
        }),
      ),
    );

    console.log("[TG-EDU-2] Results count:", results.length);

    const masterUsers = ["U14", "U18"] as const;
    masterUsers.forEach((key) => {
      const user = dataManager.getStoryBy(key);
      expect(results.find((r) => r.userId === user.userId)).toBeUndefined();
    });

    results.forEach((r) => {
      expect(r.matchedContext.educationLevel).not.toBe("MASTER");
    });

    validateAllPaths(results, "TG-EDU-2");
  });
});
