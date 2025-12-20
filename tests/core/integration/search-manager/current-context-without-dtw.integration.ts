/**
 * searchByUser WITHOUT DTW (single context users)
 * Business rule: Automatic fallback to searchByContext when no trajectory exists
 */

import { describe, it, expect } from "vitest";
import { driver } from "../../helpers/drivers/shared-driver.js";
import { FixtureSearchManager, createUserSearchParams } from "../../helpers/fixture-search-manager.js";
import { UserStories } from "../../helpers/user-stories.js";

describe("User Context Search WITHOUT DTW (UN1-UN4)", () => {
  // Business rule: Single context user → fallback to searchByContext (no DTW)
  // Expected: Find users with matching CURRENT context position
  it("UN1: No trajectory fallback - single context user falls back to searchByContext", async () => {
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new UserStories();

    const u4 = dataManager.getStoryBy("U4");
    const u4Context = u4.contexts[0]!;

    console.log("[UN1] Searching for user with single context (no trajectory)");
    console.log("[UN1] U4 context:", {
      position: u4Context.position,
      domains: u4Context.domains,
      skills: u4Context.skills,
      previousContextId: u4Context.previousContextId,
    });

    expect(u4Context.previousContextId).toBeNull();

    const results = await searchManager.searchByUser(
      createUserSearchParams(u4.userId, {
        excludedContextFields: [
          "birthYear",
          "countryCode",
          "cityName",
          "languages",
          "domains",
          "skills",
          "industry",
          "companySize",
        ],
      }),
    );

    console.log("[UN1] Results count:", results.length);
    console.log(
      "[UN1] Top results:",
      results.slice(0, 3).map((r) => ({
        userId: r.userId,
        position: r.matchedContext.position,
        domains: r.matchedContext.domains,
        hasDTW: !!r.dtwMetrics,
        hasPath: !!r.path,
      })),
    );

    // U7 should match (Junior current context, similar to U4)
    // U1/U2/U6 current context is Middle (not Junior), so they won't match
    const u7 = dataManager.getStoryBy("U7");
    const hasU7 = results.some((r) => r.userId === u7.userId);

    expect(hasU7).toBe(true);
  });

  // Business rule: resolveContext (userId → currentContextId) + geo excluded → find geo-diverse candidates
  // Expected: U7 (Junior gb/london, current context matches U4)
  it("UN4: Exclude geo via userId - resolveContext works correctly", async () => {
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new UserStories();

    const u4 = dataManager.getStoryBy("U4");
    const u4Context = u4.contexts[0]!;

    console.log("[UN4] Searching via userId with geo excluded");
    console.log("[UN4] U4 context:", {
      position: u4Context.position,
      domains: u4Context.domains,
      skills: u4Context.skills,
      geo: `${u4Context.countryCode}/${u4Context.cityName}`,
    });

    const results = await searchManager.searchByUser(
      createUserSearchParams(u4.userId, {
        excludedContextFields: [
          "countryCode",
          "cityName",
          "birthYear",
          "languages",
          "domains",
          "skills",
          "industry",
          "companySize",
        ],
      }),
    );

    console.log("[UN4] Results count:", results.length);
    console.log("[UN4] Countries found:", [...new Set(results.map((r) => r.matchedContext.countryCode))]);

    // U7 should be in results (Junior, current context matches U4)
    // U1/U2/U6 current context is Middle (not Junior), so they won't match
    const u7 = dataManager.getStoryBy("U7");
    expect(results.find((r) => r.userId === u7.userId)).toBeTruthy();

    // U7 is from gb/london, U4 is from us/seattle
    const internationalResults = results.filter((r) => r.matchedContext.countryCode !== "us");
    expect(internationalResults.length).toBeGreaterThanOrEqual(1);
    console.log(`[UN4] International results count: ${internationalResults.length} (expected >= 1)`);
  });
});
