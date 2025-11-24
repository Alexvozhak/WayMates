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

import { describe, it, expect } from "vitest";
import { driver } from "../../helpers/drivers/shared-driver.js";
import { FixtureSearchManager } from "../../helpers/fixture-search-manager.js";
import { UserStories } from "../../helpers/user-stories.js";
import { validateAllPaths } from "../../helpers/path-validator.js";

describe("Target Search (TG1-TG7)", () => {
  // Business rule: Desired position filter matches ONLY candidates with exact position.
  // Target search scans ALL contexts (historical + current) to find who reached target.
  it("TG1: Desired position - finds only candidates with specified position", async () => {
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new UserStories();
    const u3 = dataManager.getStoryBy("U3");

    console.log("[TG1] Searching for position: Middle (desired mode)");

    const results = await searchManager.searchByTarget({
      userId: u3.userId,
      criteria: {
        position: {
          mode: "desired",
          values: ["middle"],
        },
      },
      excludedCreationReasons: [],
      limit: 10,
    });

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

    const results = await searchManager.searchByTarget({
      userId: u3.userId,
      criteria: {
        position: {
          mode: "undesired",
          values: ["junior"],
        },
      },
      excludedCreationReasons: [],
      limit: 10,
    });

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

    const results = await searchManager.searchByTarget({
      userId: u3.userId,
      criteria: {
        domains: {
          mode: "desired",
          values: ["frontend"],
        },
      },
      excludedCreationReasons: [],
      limit: 20,
    });

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

    const results = await searchManager.searchByTarget({
      userId: u3.userId,
      criteria: {
        domains: {
          mode: "undesired",
          values: ["frontend"],
        },
      },
      excludedCreationReasons: [],
      limit: 20,
    });

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

    const results = await searchManager.searchByTarget({
      userId: u3.userId,
      criteria: {
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
      },
      excludedCreationReasons: [],
      limit: 20,
    });

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
      const hasMatch = languages.some((lang) => ["en", "fr"].includes(lang));
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
      const hasEn = languages.includes("en");
      expect(hasEn).toBe(false);
    });

    validateAllPaths(results, "TG-LANG-2");
  });
});
