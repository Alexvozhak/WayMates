/**
 * Target Search Integration Tests (TG1-TG7)
 *
 * Tests searchByTarget() with FieldFilter modes (desired/undesired)
 * Uses Batch A+B test data (U1-U18) from globalSetup
 *
 * Test focus:
 * - TG1: Desired position (include specific position)
 * - TG2: Undesired position (exclude specific position)
 * - TG3: Desired domains (ANY match)
 * - TG4: Undesired domains (NONE match)
 * - TG5: Desired skills (ANY match)
 * - TG6: Undesired skills (NONE match)
 * - TG7: Combined filters (position + domains + skills)
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createDriver } from "../../../src/neo4j.js";
import { FixtureSearchManager } from "../../helpers/fixture-search-manager.js";
import { TestDataManager } from "../../helpers/test-data-manager.js";
import { validateAllPaths } from "../../helpers/path-validator.js";
import type { Driver } from "neo4j-driver";

let driver: Driver;

beforeAll(() => {
  driver = createDriver(); // Uses U1-U18 from globalSetup
});

afterAll(async () => {
  await driver.close();
});

describe("Target Search (TG1-TG7)", () => {
  it("TG1: Desired position - finds only candidates with specified position", async () => {
    // Arrange
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new TestDataManager();

    // U3: Junior Backend Go, fr - searching for Middle positions
    const u3 = dataManager.getStoryBy("U3");

    console.log("[TG1] Searching for position: Middle (desired mode)");

    // Act - Search by target criteria with desired position
    const results = await searchManager.searchByTarget({
      userId: u3.userId,
      criteria: {
        position: {
          mode: "desired",
          values: ["Middle"],
        },
      },
      excludedCreationReasons: [],
      limit: 10,
    });

    // Assert
    console.log("[TG1] Results count:", results.length);
    console.log(
      "[TG1] Matched users:",
      results.map((r) => ({
        userId: r.userId,
        position: r.matchedContext.position,
        domains: r.matchedContext.domains,
      })),
    );

    // U5 is the only Middle position user
    const u5 = dataManager.getStoryBy("U5");
    const hasU5 = results.some((r) => r.userId === u5.userId);
    expect(hasU5).toBe(true);

    // All results should have position=Middle
    results.forEach((r) => {
      expect(r.matchedContext.position).toBe("Middle");
    });

    // Filter mode logging (desired mode)
    console.log(
      `[TG1] Filter mode: desired, matched positions: ${results.map((r) => r.matchedContext.position).join(", ")}`,
    );
    console.log(
      `[TG1] All results match desired position? ${results.every((r) => r.matchedContext.position === "Middle")}`,
    );

    // Path structure validation
    validateAllPaths(results, "TG1");

    // Time calculation verification
    results.forEach((r) => {
      const now = new Date();
      const matchedDate = new Date(r.matchedContext.createdAt);
      const monthsDiff = Math.floor(
        (now.getTime() - matchedDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44),
      );

      // timeSinceMatchedMonths should be >= 0 (recent or in past)
      if (r.timeSinceMatchedMonths != null) {
        // Check for null AND undefined
        expect(r.timeSinceMatchedMonths).toBeGreaterThanOrEqual(0);
        console.log(
          `[TG1] Time since matched for ${r.userId.slice(0, 8)}: ${r.timeSinceMatchedMonths} months`,
        );
      }
    });
  });

  it("TG2: Undesired position - excludes candidates with specified position", async () => {
    // Arrange
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new TestDataManager();

    const u3 = dataManager.getStoryBy("U3");

    console.log("[TG2] Excluding position: Junior (undesired mode)");

    // Act - Search with undesired position (exclude Junior)
    const results = await searchManager.searchByTarget({
      userId: u3.userId,
      criteria: {
        position: {
          mode: "undesired",
          values: ["Junior"],
        },
      },
      excludedCreationReasons: [],
      limit: 10,
    });

    // Assert
    console.log("[TG2] Results count:", results.length);
    console.log(
      "[TG2] Matched positions:",
      results.map((r) => r.matchedContext.position),
    );

    // U5 should be in results (Middle position, not Junior)
    const u5 = dataManager.getStoryBy("U5");
    const hasU5 = results.some((r) => r.userId === u5.userId);
    expect(hasU5).toBe(true);

    // None of the results should have position=Junior
    results.forEach((r) => {
      expect(r.matchedContext.position).not.toBe("Junior");
    });

    // Verify single-context Junior users (U4, U7) are NOT in results
    // Note: U1, U2 have trajectories (Junior → Middle), so their Middle contexts WILL be found
    // This is correct behavior - Target Search finds ANY matching context
    const u4 = dataManager.getStoryBy("U4"); // Single context: Junior Frontend
    const u7 = dataManager.getStoryBy("U7"); // Single context: Junior Backend

    expect(results.find((r) => r.userId === u4.userId)).toBeUndefined();
    expect(results.find((r) => r.userId === u7.userId)).toBeUndefined();

    // Filter mode logging (undesired mode)
    const uniquePositions = [...new Set(results.map((r) => r.matchedContext.position))];
    console.log(`[TG2] Filter mode: undesired, excluded position: Junior`);
    console.log(`[TG2] Found positions: ${uniquePositions.join(", ")}`);
    console.log(
      `[TG2] No results have excluded position? ${!results.some((r) => r.matchedContext.position === "Junior")}`,
    );

    // Path structure validation
    validateAllPaths(results, "TG2");

    // Time calculation verification - trajectory vs single context
    const withTrajectory = results.filter((r) => r.path && r.path.length > 1);
    const singleContext = results.filter((r) => !r.path || r.path.length <= 1);

    console.log(
      `[TG2] Time calculation - ${withTrajectory.length} with trajectory, ${singleContext.length} single context`,
    );

    results.forEach((r) => {
      if (r.timeSinceMatchedMonths != null) {
        // Check for null AND undefined
        expect(r.timeSinceMatchedMonths).toBeGreaterThanOrEqual(0);
      }
    });
  });

  it("TG3: Desired domains - finds candidates with ANY matching domain", async () => {
    // Arrange
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new TestDataManager();

    const u3 = dataManager.getStoryBy("U3"); // Backend user

    console.log("[TG3] Searching for domains: Frontend (desired mode)");

    // Act - Search for Frontend domain (ANY match)
    const results = await searchManager.searchByTarget({
      userId: u3.userId,
      criteria: {
        domains: {
          mode: "desired",
          values: ["Frontend"],
        },
      },
      excludedCreationReasons: [],
      limit: 20,
    });

    // Assert
    console.log("[TG3] Results count:", results.length);
    console.log(
      "[TG3] Sample results:",
      results.slice(0, 3).map((r) => ({
        userId: r.userId,
        position: r.matchedContext.position,
        domains: r.matchedContext.domains,
      })),
    );

    // U1, U2, U4, U5, U6, U9, U12 have Frontend domain
    const frontendUsers = ["U1", "U2", "U4", "U5", "U6", "U9", "U12"];
    const frontendUserIds = frontendUsers.map(
      (key) => dataManager.getStoryBy(key as keyof typeof dataManager).userId,
    );

    const matchedUserIds = results.map((r) => r.userId);
    const hasFrontendUsers = frontendUserIds.some((id) => matchedUserIds.includes(id));
    expect(hasFrontendUsers).toBe(true);

    // All results should have Frontend in domains
    results.forEach((r) => {
      expect(r.matchedContext.domains).toContain("Frontend");
    });

    // Verify Backend-only users (U7, U8, U10, U11) are NOT in results
    const u7 = dataManager.getStoryBy("U7");
    const u8 = dataManager.getStoryBy("U8");
    expect(results.find((r) => r.userId === u7.userId)).toBeUndefined();
    expect(results.find((r) => r.userId === u8.userId)).toBeUndefined();

    // Filter mode logging (desired domains - ANY match)
    console.log(`[TG3] Filter mode: desired domains, value: Frontend (ANY match logic)`);
    console.log(
      `[TG3] All results contain Frontend? ${results.every((r) => r.matchedContext.domains.includes("Frontend"))}`,
    );

    // Path structure validation
    validateAllPaths(results, "TG3");
  });

  it("TG4: Undesired domains - excludes candidates with ANY matching domain", async () => {
    // Arrange
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new TestDataManager();

    const u3 = dataManager.getStoryBy("U3");

    console.log("[TG4] Excluding domains: Frontend (undesired mode)");

    // Act - Exclude Frontend domain (NONE match)
    const results = await searchManager.searchByTarget({
      userId: u3.userId,
      criteria: {
        domains: {
          mode: "undesired",
          values: ["Frontend"],
        },
      },
      excludedCreationReasons: [],
      limit: 20,
    });

    // Assert
    console.log("[TG4] Results count:", results.length);
    console.log(
      "[TG4] Matched domains:",
      results.map((r) => r.matchedContext.domains),
    );

    // Backend users (U7, U8, U10, U11) should be in results
    const backendUsers = ["U7", "U8", "U10", "U11"];
    const backendUserIds = backendUsers.map(
      (key) => dataManager.getStoryBy(key as keyof typeof dataManager).userId,
    );

    const matchedUserIds = results.map((r) => r.userId);
    const hasBackendUsers = backendUserIds.some((id) => matchedUserIds.includes(id));
    expect(hasBackendUsers).toBe(true);

    // None of the results should have Frontend in domains
    results.forEach((r) => {
      expect(r.matchedContext.domains).not.toContain("Frontend");
    });

    // Verify Frontend users (U1, U2, U4) are NOT in results
    const u1 = dataManager.getStoryBy("U1");
    const u2 = dataManager.getStoryBy("U2");
    const u4 = dataManager.getStoryBy("U4");
    expect(results.find((r) => r.userId === u1.userId)).toBeUndefined();
    expect(results.find((r) => r.userId === u2.userId)).toBeUndefined();
    expect(results.find((r) => r.userId === u4.userId)).toBeUndefined();

    // Filter mode logging (undesired domains - NONE match)
    console.log(`[TG4] Filter mode: undesired domains, value: Frontend (NONE match logic)`);
    console.log(
      `[TG4] No results contain Frontend? ${!results.some((r) => r.matchedContext.domains.includes("Frontend"))}`,
    );

    // Path structure validation
    validateAllPaths(results, "TG4");
  });

  it("TG5: Desired skills - finds candidates with ANY matching skill", async () => {
    // Arrange
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new TestDataManager();

    const u3 = dataManager.getStoryBy("U3");

    console.log("[TG5] Searching for skills: python (desired mode)");

    // Act - Search for python skill (ANY match)
    const results = await searchManager.searchByTarget({
      userId: u3.userId,
      criteria: {
        skills: {
          mode: "desired",
          values: ["python"],
        },
      },
      excludedCreationReasons: [],
      limit: 20,
    });

    // Assert
    console.log("[TG5] Results count:", results.length);
    console.log(
      "[TG5] Sample skills:",
      results.slice(0, 3).map((r) => ({
        userId: r.userId,
        skills: r.matchedContext.skills.slice(0, 3),
      })),
    );

    // U8, U11, U13 have python skill
    const pythonUsers = ["U8", "U11", "U13"];
    const pythonUserIds = pythonUsers.map(
      (key) => dataManager.getStoryBy(key as keyof typeof dataManager).userId,
    );

    const matchedUserIds = results.map((r) => r.userId);
    const hasPythonUsers = pythonUserIds.some((id) => matchedUserIds.includes(id));
    expect(hasPythonUsers).toBe(true);

    // All results should have python in skills
    results.forEach((r) => {
      expect(r.matchedContext.skills).toContain("python");
    });

    // Verify react-only users (U1, U2) are NOT in results
    const u1 = dataManager.getStoryBy("U1");
    const u2 = dataManager.getStoryBy("U2");
    expect(results.find((r) => r.userId === u1.userId)).toBeUndefined();
    expect(results.find((r) => r.userId === u2.userId)).toBeUndefined();

    // Filter mode logging (desired skills - ANY match)
    console.log(`[TG5] Filter mode: desired skills, value: python (ANY match logic)`);
    console.log(
      `[TG5] All results contain python? ${results.every((r) => r.matchedContext.skills.includes("python"))}`,
    );

    // Path structure validation
    validateAllPaths(results, "TG5");
  });

  it("TG6: Undesired skills - excludes candidates with ANY matching skill", async () => {
    // Arrange
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new TestDataManager();

    const u3 = dataManager.getStoryBy("U3");

    console.log("[TG6] Excluding skills: python (undesired mode)");

    // Act - Exclude python skill (NONE match)
    const results = await searchManager.searchByTarget({
      userId: u3.userId,
      criteria: {
        skills: {
          mode: "undesired",
          values: ["python"],
        },
      },
      excludedCreationReasons: [],
      limit: 20,
    });

    // Assert
    console.log("[TG6] Results count:", results.length);
    console.log(
      "[TG6] Sample users without python:",
      results.slice(0, 3).map((r) => ({
        userId: r.userId,
        skills: r.matchedContext.skills.slice(0, 3),
      })),
    );

    // Users without python (U1, U2, U4, U5, U6, U7, U9, U10, U12)
    const nonPythonUsers = ["U1", "U2", "U4", "U5", "U6", "U7", "U9", "U10", "U12"];
    const nonPythonUserIds = nonPythonUsers.map(
      (key) => dataManager.getStoryBy(key as keyof typeof dataManager).userId,
    );

    const matchedUserIds = results.map((r) => r.userId);
    const hasNonPythonUsers = nonPythonUserIds.some((id) => matchedUserIds.includes(id));
    expect(hasNonPythonUsers).toBe(true);

    // None of the results should have python in skills
    results.forEach((r) => {
      expect(r.matchedContext.skills).not.toContain("python");
    });

    // Verify python users (U8, U11, U13) are NOT in results
    const u8 = dataManager.getStoryBy("U8");
    const u11 = dataManager.getStoryBy("U11");
    const u13 = dataManager.getStoryBy("U13");
    expect(results.find((r) => r.userId === u8.userId)).toBeUndefined();
    expect(results.find((r) => r.userId === u11.userId)).toBeUndefined();
    expect(results.find((r) => r.userId === u13.userId)).toBeUndefined();

    // Filter mode logging (undesired skills - NONE match)
    console.log(`[TG6] Filter mode: undesired skills, value: python (NONE match logic)`);
    console.log(
      `[TG6] No results contain python? ${!results.some((r) => r.matchedContext.skills.includes("python"))}`,
    );

    // Path structure validation
    validateAllPaths(results, "TG6");
  });

  it("TG7: Combined filters - position + domains + skills", async () => {
    // Arrange
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new TestDataManager();

    const u3 = dataManager.getStoryBy("U3");

    console.log("[TG7] Combined: Junior + Backend + NOT python");

    // Act - Combined filters
    const results = await searchManager.searchByTarget({
      userId: u3.userId,
      criteria: {
        position: {
          mode: "desired",
          values: ["Junior"],
        },
        domains: {
          mode: "desired",
          values: ["Backend"],
        },
        skills: {
          mode: "undesired",
          values: ["python"],
        },
      },
      excludedCreationReasons: [],
      limit: 20,
    });

    // Assert
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

    // Expected: U7 (Junior Backend java/spring), U10 (Junior Backend nodejs/javascript)
    const u7 = dataManager.getStoryBy("U7");
    const u10 = dataManager.getStoryBy("U10");

    const hasU7 = results.some((r) => r.userId === u7.userId);
    const hasU10 = results.some((r) => r.userId === u10.userId);

    expect(hasU7 || hasU10).toBe(true); // At least one should match

    // All results should match combined criteria
    results.forEach((r) => {
      expect(r.matchedContext.position).toBe("Junior");
      expect(r.matchedContext.domains).toContain("Backend");
      expect(r.matchedContext.skills).not.toContain("python");
    });

    // Verify excluded users
    // U8, U11 - Junior Backend BUT with python (excluded by skills filter)
    // U1, U2, U4 - Junior Frontend (excluded by domains filter)
    const u8 = dataManager.getStoryBy("U8");
    const u11 = dataManager.getStoryBy("U11");
    const u1 = dataManager.getStoryBy("U1");

    expect(results.find((r) => r.userId === u8.userId)).toBeUndefined();
    expect(results.find((r) => r.userId === u11.userId)).toBeUndefined();
    expect(results.find((r) => r.userId === u1.userId)).toBeUndefined();

    // Filter mode logging (combined filters)
    console.log(
      `[TG7] Filter mode: desired position=Junior + desired domains=Backend + undesired skills=python`,
    );
    console.log(
      `[TG7] All match position? ${results.every((r) => r.matchedContext.position === "Junior")}`,
    );
    console.log(
      `[TG7] All match domains? ${results.every((r) => r.matchedContext.domains.includes("Backend"))}`,
    );
    console.log(
      `[TG7] None match excluded skills? ${!results.some((r) => r.matchedContext.skills.includes("python"))}`,
    );

    // Path structure validation
    validateAllPaths(results, "TG7");
  });

  it("TG-LANG-1: Desired languages - finds candidates with ANY specified language (OR logic)", async () => {
    // Arrange
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new TestDataManager();

    console.log("[TG-LANG-1] Searching for languages: ['en', 'fr'] (desired mode, OR logic)");
    const u3 = dataManager.getStoryBy("U3");

    // Act - Search by target criteria with desired languages
    const results = await searchManager.searchByTarget({
      userId: u3.userId,
      criteria: {
        languages: {
          mode: "desired",
          values: ["en", "fr"],
        },
      },
      excludedCreationReasons: [],
      limit: 10,
    });

    // Assert
    console.log("[TG-LANG-1] Results count:", results.length);
    console.log(
      "[TG-LANG-1] Matched users:",
      results.map((r) => ({
        userId: r.userId,
        languages: r.matchedContext.languages,
      })),
    );

    // Business rule: Desired mode → ANY match (OR logic)
    // Expected: U1 (["en"]) and U4 (["en", "de"]) should match
    // U2 (["de"]) should NOT match (neither "en" nor "fr")

    const u1 = dataManager.getStoryBy("U1");
    const u4 = dataManager.getStoryBy("U4");
    const u2 = dataManager.getStoryBy("U2");

    const hasU1 = results.some((r) => r.userId === u1.userId);
    const hasU4 = results.some((r) => r.userId === u4.userId);
    const hasU2 = results.some((r) => r.userId === u2.userId);

    expect(hasU1).toBe(true); // U1 has "en" → matches
    expect(hasU4).toBe(true); // U4 has "en" → matches
    expect(hasU2).toBe(false); // U2 has only "de" → does NOT match

    // Verify all results have at least ONE language from ["en", "fr"]
    results.forEach((r) => {
      const languages = r.matchedContext.languages || [];
      const hasMatch = languages.some((lang) => ["en", "fr"].includes(lang));
      expect(hasMatch).toBe(true);
    });

    console.log(
      `[TG-LANG-1] All results match desired languages (ANY)? ${results.every((r) => {
        const langs = r.matchedContext.languages || [];
        return langs.some((l) => ["en", "fr"].includes(l));
      })}`,
    );

    // Path structure validation
    validateAllPaths(results, "TG-LANG-1");
  });

  it("TG-LANG-2: Undesired languages - excludes candidates with ANY specified language (NONE logic)", async () => {
    // Arrange
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new TestDataManager();

    console.log("[TG-LANG-2] Searching for undesired languages: ['en'] (exclude ALL with 'en')");
    const u3 = dataManager.getStoryBy("U3");

    // Act - Search by target criteria with undesired languages
    const results = await searchManager.searchByTarget({
      userId: u3.userId,
      criteria: {
        languages: {
          mode: "undesired",
          values: ["en"],
        },
      },
      excludedCreationReasons: [],
      limit: 10,
    });

    // Assert
    console.log("[TG-LANG-2] Results count:", results.length);
    console.log(
      "[TG-LANG-2] Matched users:",
      results.map((r) => ({
        userId: r.userId,
        languages: r.matchedContext.languages,
      })),
    );

    // Business rule: Undesired mode → NONE match (exclude all with "en")
    // Expected: U2 (["de"]) should match
    // U1 (["en"]) and U4 (["en", "de"]) should NOT match

    const u1 = dataManager.getStoryBy("U1");
    const u4 = dataManager.getStoryBy("U4");
    const u2 = dataManager.getStoryBy("U2");

    const hasU1 = results.some((r) => r.userId === u1.userId);
    const hasU4 = results.some((r) => r.userId === u4.userId);
    const hasU2 = results.some((r) => r.userId === u2.userId);

    expect(hasU1).toBe(false); // U1 has "en" → excluded
    expect(hasU4).toBe(false); // U4 has "en" → excluded
    expect(hasU2).toBe(true); // U2 has only "de" → included

    // Verify NO results have "en" in their languages
    results.forEach((r) => {
      const languages = r.matchedContext.languages || [];
      const hasEn = languages.includes("en");
      expect(hasEn).toBe(false);
    });

    console.log(
      `[TG-LANG-2] All results exclude undesired language 'en'? ${results.every((r) => {
        const langs = r.matchedContext.languages || [];
        return !langs.includes("en");
      })}`,
    );

    // Path structure validation
    validateAllPaths(results, "TG-LANG-2");
  });
});
