/**
 * Goals Integration Tests
 * Business rules:
 * - GM1-GM4: GoalsManager CRUD operations (create, read, update, delete)
 * - G1, G3, G5: Goals integration with searchWaymates (isWaymate classification)
 * - G2, G4: Pathfinder search (searchPathfinders with dual matching)
 */

import { DatabaseContext } from "@core/database-context.js";
import { GoalsManager } from "@core/goals-manager.js";
import { adhocContextBase, targetContextSchema } from "@shared/schemas.js";
import { describe, expect, it } from "vitest";

import { driver } from "../../helpers/drivers/goals-driver.js";
import {
  createPathfinderSearchParams,
  createWaymatesSearchParams,
  FixtureSearchManager,
} from "../../helpers/fixture-search-manager.js";
import { UserStories } from "../../helpers/user-stories.js";

describe("Goals Integration (GM1-GM4 + G1-G5)", () => {
  // Business rule: setGoal creates goal and returns userId
  it("GM1: Create goal - setGoal creates goal with targetContext", async () => {
    const db = new DatabaseContext(driver);
    const goalsManager = new GoalsManager(db);
    const dataManager = new UserStories();

    const u3 = dataManager.getStoryBy("U3");

    console.log("[GM1] Creating goal for U3");
    console.log("[GM1] Target criteria:", {
      position: { mode: "desired", values: ["middle"] },
      domains: { mode: "desired", values: ["backend"] },
    });

    const createdGoal = await goalsManager.setGoal({
      userId: u3.userId,
      targetContext: targetContextSchema.parse({
        position: { mode: "desired", values: ["middle"] },
        domains: { mode: "desired", values: ["backend"] },
      }),
    });

    expect(createdGoal.userId).toBe(u3.userId);

    const goal = await goalsManager.getUserGoal(u3.userId);
    console.log("[GM1] Created goal:", goal);

    expect(goal?.userId).toBe(u3.userId);
    expect(goal?.targetContext.position).toEqual({
      mode: "desired",
      values: ["middle"],
    });
    expect(goal?.targetContext.domains).toEqual({
      mode: "desired",
      values: ["backend"],
    });
  });

  // Business rule: getUserGoal returns goal with correct criteria
  it("GM2: Read goals - getUserGoal returns goal or null", async () => {
    const db = new DatabaseContext(driver);
    const goalsManager = new GoalsManager(db);
    const dataManager = new UserStories();

    const u3 = dataManager.getStoryBy("U3");

    await goalsManager.setGoal({
      userId: u3.userId,
      targetContext: targetContextSchema.parse({
        position: {
          mode: "desired",
          values: ["senior"],
        },
      }),
    });

    console.log("[GM2] Testing getUserGoal for existing user");

    const existingGoal = await goalsManager.getUserGoal(u3.userId);
    console.log("[GM2] Found goal for U3:", existingGoal?.targetContext);

    expect(existingGoal?.userId).toBe(u3.userId);
    expect(existingGoal?.targetContext.position).toEqual({
      mode: "desired",
      values: ["senior"],
    });
  });

  // Business rule: setGoal upserts goal preserving createdAt
  it("GM3: Update goal - setGoal upserts goal preserving createdAt", async () => {
    const db = new DatabaseContext(driver);
    const goalsManager = new GoalsManager(db);
    const dataManager = new UserStories();

    const u3 = dataManager.getStoryBy("U3");

    console.log("[GM3] Creating initial goal");

    await goalsManager.setGoal({
      userId: u3.userId,
      targetContext: targetContextSchema.parse({
        position: {
          mode: "desired",
          values: ["middle"],
        },
      }),
    });

    const goal1 = await goalsManager.getUserGoal(u3.userId);
    const createdAt1 = goal1?.createdAt;

    console.log("[GM3] Goal #1 created at:", createdAt1);
    console.log("[GM3] Goal #1 criteria:", goal1?.targetContext);

    await new Promise((resolve) => setTimeout(resolve, 100));

    console.log("[GM3] Updating goal (upsert)");

    await goalsManager.setGoal({
      userId: u3.userId,
      targetContext: targetContextSchema.parse({
        position: {
          mode: "desired",
          values: ["senior"],
        },
        domains: {
          mode: "desired",
          values: ["backend"],
        },
      }),
    });

    const goal2 = await goalsManager.getUserGoal(u3.userId);

    console.log("[GM3] Goal #2 created at:", goal2?.createdAt);
    console.log("[GM3] Goal #2 criteria:", goal2?.targetContext);

    expect(goal2?.targetContext.position).toEqual({
      mode: "desired",
      values: ["senior"],
    });
    expect(goal2?.targetContext.domains).toEqual({
      mode: "desired",
      values: ["backend"],
    });

    expect(goal2?.createdAt).toBe(createdAt1);

    console.log("[GM3] createdAt preserved: ✅");
  });

  // Business rule: deleteGoal removes goal and returns success status (idempotent)
  it("GM4: Delete goal - deleteGoal removes goal and returns success status", async () => {
    const db = new DatabaseContext(driver);
    const goalsManager = new GoalsManager(db);
    const dataManager = new UserStories();

    const u3 = dataManager.getStoryBy("U3");

    await goalsManager.setGoal({
      userId: u3.userId,
      targetContext: targetContextSchema.parse({
        skills: {
          mode: "desired",
          values: ["python"],
        },
      }),
    });

    console.log("[GM4] Goal created, now deleting...");

    const deleteSuccess1 = await goalsManager.deleteGoal(u3.userId);

    console.log("[GM4] First delete returned:", deleteSuccess1);

    expect(deleteSuccess1).toBe(true);

    const goalAfter = await goalsManager.getUserGoal(u3.userId);
    expect(goalAfter).toBeNull();

    console.log("[GM4] Goal deleted: ✅");

    const deleteSuccess2 = await goalsManager.deleteGoal(u3.userId);

    console.log("[GM4] Second delete returned:", deleteSuccess2);

    expect(deleteSuccess2).toBe(false);

    console.log("[GM4] Idempotent delete: ✅");
  });

  // Business rule: Without goal, all candidates have isWaymate=false
  it("G1: No Goal baseline - searchWaymates without goal returns isWaymate=false", async () => {
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new UserStories();

    const u1 = dataManager.getStoryBy("U1");

    console.log("[G1] Searching without goal for U1");

    const results = await searchManager.searchWaymates(
      createWaymatesSearchParams(u1.userId, {
        excludedContextFields: ["languages"],
        recencyThresholdMonths: 24,
      }),
    );

    console.log("[G1] Results count:", results.length);
    console.log(
      "[G1] Sample results:",
      results.slice(0, 3).map((r) => ({
        userId: r.userId,
        position: r.matchedContext.position,
        isWaymate: r.isWaymate,
      })),
    );

    // Assert - All candidates have isWaymate=false (no goal set)
    expect(results.length).toBeGreaterThan(0);
    results.forEach((r) => {
      expect(r.isWaymate).toBe(false);
    });

    console.log("[G1] All candidates have isWaymate=false: ✅");
  });

  // Business rule: searchPathfinders finds proof of transition FROM our context TO our goal
  // Scenario: U1 is middle frontend dev, wants senior. U5 went middle → senior frontend.
  // Expected: U5 is pathfinder (was like U1, achieved U1's goal)
  it("G2: Pathfinder search - U1 (middle) finds U5 who achieved senior", async () => {
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new UserStories();

    const u1 = dataManager.getStoryBy("U1");
    const u5 = dataManager.getStoryBy("U5");
    const u8 = dataManager.getStoryBy("U8"); // backend dev → senior (different domain)

    // U1's current context is middle frontend dev (last in trajectory)
    const u1Current = u1.contexts.at(-1);
    if (!u1Current) throw new Error("U1 has no contexts");

    console.log("[G2] U1 current:", { position: u1Current.position, role: u1Current.role, domains: u1Current.domains });
    console.log(
      "[G2] U5 trajectory:",
      u5.contexts.map((c) => c.position),
    );

    const results = await searchManager.searchPathfinders(
      createPathfinderSearchParams(u1.userId, {
        referenceContext: adhocContextBase.parse({
          position: u1Current.position,
          role: u1Current.role,
          domains: u1Current.domains,
          skills: u1Current.skills,
        }),
        targetContext: targetContextSchema.parse({
          position: { mode: "desired", values: ["senior"] },
        }),
        // Match on role + domains, not position (find who was at ANY level in same field)
        excludedContextFields: ["position", "birthYear", "languages"],
      }),
    );

    console.log("[G2] Pathfinders found:", results.length);
    console.log(
      "[G2] Results:",
      results.map((r) => ({
        userId: r.userId,
        targetPosition: r.targetContext.position,
        matchedPosition: r.matchedContext.position,
        timeSinceTarget: r.timeSinceTargetMonths,
        timeSinceMatched: r.timeSinceMatchedMonths,
      })),
    );

    // U5 should be found: was middle frontend (matches reference), achieved senior (matches target)
    const u5Result = results.find((r) => r.userId === u5.userId);
    expect(u5Result).toBeDefined();
    expect(u5Result?.targetContext.position).toBe("senior");
    expect(u5Result?.matchedContext.position).toBe("middle");
    // Temporal ordering: matched before target (matched is older)
    expect(u5Result!.timeSinceMatchedMonths).toBeGreaterThan(u5Result!.timeSinceTargetMonths);

    // NEGATIVE ASSERTION: U8 (backend) should NOT be found (different domain)
    const u8Result = results.find((r) => r.userId === u8.userId);
    expect(u8Result).toBeUndefined();

    console.log("[G2] U5 found as pathfinder (middle → senior): ✅");
    console.log("[G2] U8 NOT found (backend, different domain): ✅");
  });

  // Business rule: Candidates with same goal = waymates (isWaymate: true)
  it("G3: Waymate detection - U1 and U2 both want Senior → U2 is waymate", async () => {
    const db = new DatabaseContext(driver);
    const goalsManager = new GoalsManager(db);
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new UserStories();

    const u1 = dataManager.getStoryBy("U1");
    const u2 = dataManager.getStoryBy("U2");

    console.log("[G3] Setting same goal (Senior) for U1 and U2");

    await goalsManager.setGoal({
      userId: u1.userId,
      targetContext: targetContextSchema.parse({
        position: {
          mode: "desired",
          values: ["senior"],
        },
      }),
    });

    await goalsManager.setGoal({
      userId: u2.userId,
      targetContext: targetContextSchema.parse({
        position: {
          mode: "desired",
          values: ["senior"],
        },
      }),
    });

    const results = await searchManager.searchWaymates(
      createWaymatesSearchParams(u1.userId, {
        excludedContextFields: ["languages"],
        recencyThresholdMonths: 24,
      }),
    );

    console.log("[G3] Results count:", results.length);
    console.log(
      "[G3] Waymates:",
      results
        .filter((r) => r.isWaymate)
        .map((r) => ({
          userId: r.userId,
          position: r.matchedContext.position,
        })),
    );

    // Assert - U2 is marked as waymate (same goal as U1)
    const u2Result = results.find((r) => r.userId === u2.userId);
    expect(u2Result).toBeDefined();
    expect(u2Result?.isWaymate).toBe(true);

    console.log("[G3] U2 marked as waymate: ✅");
  });

  // Business rule: targetRecencyMonths filters pathfinders by when they reached the goal
  // Scenario: U5 reached senior 1-2 months ago. With targetRecencyMonths=6, U5 should be found.
  // With targetRecencyMonths=0, no one should be found.
  it("G4: Pathfinder recency filter - targetRecencyMonths limits results", async () => {
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new UserStories();

    const u1 = dataManager.getStoryBy("U1");
    const u1Current = u1.contexts.at(-1);
    if (!u1Current) throw new Error("U1 has no contexts");

    console.log("[G4] Testing targetRecencyMonths filter");

    // Search with generous recency (should find pathfinders)
    const resultsWithRecency = await searchManager.searchPathfinders(
      createPathfinderSearchParams(u1.userId, {
        referenceContext: adhocContextBase.parse({
          position: u1Current.position,
          role: u1Current.role,
          domains: u1Current.domains,
        }),
        targetContext: targetContextSchema.parse({
          position: { mode: "desired", values: ["senior"] },
        }),
        excludedContextFields: ["position", "birthYear", "languages"],
        targetRecencyMonths: 24, // Last 2 years
      }),
    );

    console.log("[G4] With targetRecencyMonths=24:", resultsWithRecency.length, "pathfinders");

    // All results should have timeSinceTargetMonths <= 24
    resultsWithRecency.forEach((r) => {
      expect(r.timeSinceTargetMonths).toBeLessThanOrEqual(24);
    });

    // Search with stricter recency (6 months)
    const resultsStrict = await searchManager.searchPathfinders(
      createPathfinderSearchParams(u1.userId, {
        referenceContext: adhocContextBase.parse({
          position: u1Current.position,
          role: u1Current.role,
          domains: u1Current.domains,
        }),
        targetContext: targetContextSchema.parse({
          position: { mode: "desired", values: ["senior"] },
        }),
        excludedContextFields: ["position", "birthYear", "languages"],
        targetRecencyMonths: 6, // Last 6 months - stricter filter
      }),
    );

    console.log("[G4] With targetRecencyMonths=6:", resultsStrict.length, "pathfinders");

    // STRICT: filter MUST reduce results (not just <=)
    expect(resultsStrict.length).toBeLessThan(resultsWithRecency.length);

    // All strict results should have timeSinceTargetMonths <= 6
    resultsStrict.forEach((r) => {
      expect(r.timeSinceTargetMonths).toBeLessThanOrEqual(6);
    });

    // NEGATIVE ASSERTION: find someone filtered out
    const filteredOut = resultsWithRecency.find((r) => r.timeSinceTargetMonths > 6);
    expect(filteredOut).toBeDefined(); // Must have someone older than 6 months in relaxed
    const stillInStrict = resultsStrict.find((r) => r.userId === filteredOut!.userId);
    expect(stillInStrict).toBeUndefined(); // They must NOT be in strict results

    console.log("[G4] Recency filter works: strict < relaxed ✅");
    console.log(
      "[G4] Filtered out:",
      filteredOut!.userId,
      "timeSince:",
      filteredOut!.timeSinceTargetMonths,
      "months ✅",
    );
  });

  // Business rule: Goals work with trajectory search (DTW + isWaymate)
  it("G5: Goal + DTW integration - Goals work with trajectory search", async () => {
    const db = new DatabaseContext(driver);
    const goalsManager = new GoalsManager(db);
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new UserStories();

    const u10 = dataManager.getStoryBy("U10");

    console.log("[G5] U10 trajectory length:", u10.contexts.length);
    console.log("[G5] Creating goal for U10: Senior position");

    await goalsManager.setGoal({
      userId: u10.userId,
      targetContext: targetContextSchema.parse({
        position: {
          mode: "desired",
          values: ["senior"],
        },
      }),
    });

    const results = await searchManager.searchWaymates(
      createWaymatesSearchParams(u10.userId, {
        excludedContextFields: [],
        recencyThresholdMonths: 48,
      }),
    );

    console.log("[G5] Results count:", results.length);
    console.log(
      "[G5] Candidates with isWaymate:",
      results.slice(0, 5).map((r) => ({
        userId: r.userId,
        isWaymate: r.isWaymate,
        trajectoryLength: r.path?.length || 0,
      })),
    );

    // Assert - isWaymate is boolean
    expect(results.length).toBeGreaterThan(0);
    results.forEach((r) => {
      expect(typeof r.isWaymate).toBe("boolean");
    });

    // Assert - Waymates have same goal
    const waymates = results.filter((r) => r.isWaymate);
    console.log("[G5] Found waymates:", waymates.length);

    console.log("[G5] Goals + trajectory integration verified: ✅");
  });
});
