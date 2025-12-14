/**
 * Goals Integration Tests
 * Business rules:
 * - GM1-GM4: GoalsManager CRUD operations (create, read, update, delete)
 * - G1-G5: Goals integration with searchByUser (candidateType classification: pathfinder, waymate)
 */

import { describe, it, expect } from "vitest";
import { driver } from "../../helpers/drivers/goals-driver.js";
import { FixtureSearchManager, createUserSearchParams } from "../../helpers/fixture-search-manager.js";
import { UserStories } from "../../helpers/user-stories.js";
import { GoalsManager } from "../../../../src/core/goals-manager.js";
import { DatabaseContext } from "../../../../src/core/database-context.js";

describe("Goals Integration (GM1-GM4 + G1-G5)", () => {
  // Business rule: setGoal creates goal and returns userId
  it("GM1: Create goal - setGoal creates goal with targetCriteria", async () => {
    const db = new DatabaseContext(driver);
    const goalsManager = new GoalsManager(db);
    const dataManager = new UserStories();

    const u3 = dataManager.getStoryBy("U3");

    console.log("[GM1] Creating goal for U3");
    console.log("[GM1] Target criteria:", {
      position: { mode: "desired", values: ["middle"] },
      domains: { mode: "desired", values: ["backend"] },
    });

    const userId = await goalsManager.setGoal({
      userId: u3.userId,
      targetContext: {
        position: {
          mode: "desired",
          values: ["middle"],
        },
        domains: {
          mode: "desired",
          values: ["backend"],
        },
      },
    });

    expect(userId).toBe(u3.userId);

    const goal = await goalsManager.getUserGoal(u3.userId);
    console.log("[GM1] Created goal:", goal);

    expect(goal?.userId).toBe(u3.userId);
    expect(goal?.targetCriteria.position).toEqual({
      mode: "desired",
      values: ["middle"],
    });
    expect(goal?.targetCriteria.domains).toEqual({
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
      targetContext: {
        position: {
          mode: "desired",
          values: ["senior"],
        },
      },
    });

    console.log("[GM2] Testing getUserGoal for existing user");

    const existingGoal = await goalsManager.getUserGoal(u3.userId);
    console.log("[GM2] Found goal for U3:", existingGoal?.targetCriteria);

    expect(existingGoal?.userId).toBe(u3.userId);
    expect(existingGoal?.targetCriteria.position).toEqual({
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
      targetContext: {
        position: {
          mode: "desired",
          values: ["middle"],
        },
      },
    });

    const goal1 = await goalsManager.getUserGoal(u3.userId);
    const createdAt1 = goal1?.createdAt;

    console.log("[GM3] Goal #1 created at:", createdAt1);
    console.log("[GM3] Goal #1 criteria:", goal1?.targetCriteria);

    await new Promise((resolve) => setTimeout(resolve, 100));

    console.log("[GM3] Updating goal (upsert)");

    await goalsManager.setGoal({
      userId: u3.userId,
      targetContext: {
        position: {
          mode: "desired",
          values: ["senior"],
        },
        domains: {
          mode: "desired",
          values: ["backend"],
        },
      },
    });

    const goal2 = await goalsManager.getUserGoal(u3.userId);

    console.log("[GM3] Goal #2 created at:", goal2?.createdAt);
    console.log("[GM3] Goal #2 criteria:", goal2?.targetCriteria);

    expect(goal2?.targetCriteria.position).toEqual({
      mode: "desired",
      values: ["senior"],
    });
    expect(goal2?.targetCriteria.domains).toEqual({
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
      targetContext: {
        skills: {
          mode: "desired",
          values: ["python"],
        },
      },
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

  // Business rule: Without goal, all candidates have candidateType=null
  it("G1: No Goal baseline - searchByUser without goal returns candidateType=null", async () => {
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new UserStories();

    const u1 = dataManager.getStoryBy("U1");

    console.log("[G1] Searching without goal for U1");

    const results = await searchManager.searchByUser(
      createUserSearchParams(u1.userId, {
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
        candidateType: r.candidateType,
      })),
    );

    // Assert - All candidates have candidateType=null (no goal)
    expect(results.length).toBeGreaterThan(0);
    results.forEach((r) => {
      expect(r.candidateType).toBeNull();
    });

    console.log("[G1] All candidates have candidateType=null: ✅");
  });

  // Business rule: Candidate who achieved goal position = pathfinder
  // IMPORTANT: Exclude 'position' and 'birthYear' to allow pathfinder detection
  // (pathfinders have DIFFERENT positions than user - that's the whole point!)
  it("G2: Pathfinder detection - U5 (achieved Senior) marked as pathfinder", async () => {
    const db = new DatabaseContext(driver);
    const goalsManager = new GoalsManager(db);
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new UserStories();

    const u1 = dataManager.getStoryBy("U1");
    const u5 = dataManager.getStoryBy("U5");

    console.log("[G2] U1 goal: Senior position");
    console.log(
      "[G2] U5 trajectory positions:",
      u5.contexts.map((c) => c.position),
    );

    await goalsManager.setGoal({
      userId: u1.userId,
      targetContext: {
        position: {
          mode: "desired",
          values: ["senior"],
        },
      },
    });

    const searchParams = createUserSearchParams(u1.userId, {
      excludedContextFields: ["position", "birthYear", "languages"],
      recencyThresholdMonths: 24,
    });
    const results = await searchManager.searchByUser(searchParams);

    console.log("[G2] Results count:", results.length);
    console.log(
      "[G2] All results:",
      results.map((r) => ({
        userId: r.userId,
        position: r.matchedContext.position,
        candidateType: r.candidateType,
      })),
    );
    console.log(
      "[G2] Pathfinders:",
      results
        .filter((r) => r.candidateType === "pathfinder")
        .map((r) => ({
          userId: r.userId,
          position: r.matchedContext.position,
        })),
    );

    // Assert - U5 is marked as pathfinder (achieved Senior)
    // U5 may appear multiple times (different contexts), find Senior context specifically
    const u5SeniorResult = results.find((r) => r.userId === u5.userId && r.matchedContext.position === "senior");
    console.log(
      "[G2] U5 Senior result:",
      u5SeniorResult
        ? {
            userId: u5SeniorResult.userId,
            position: u5SeniorResult.matchedContext.position,
            candidateType: u5SeniorResult.candidateType,
          }
        : "NOT FOUND",
    );

    expect(u5SeniorResult).toBeDefined();
    expect(u5SeniorResult?.candidateType).toBe("pathfinder");
    expect(u5SeniorResult?.matchedContext.position).toBe("senior");

    console.log("[G2] U5 marked as pathfinder: ✅");
  });

  // Business rule: Candidates with same goal = waymates
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
      targetContext: {
        position: {
          mode: "desired",
          values: ["senior"],
        },
      },
    });

    await goalsManager.setGoal({
      userId: u2.userId,
      targetContext: {
        position: {
          mode: "desired",
          values: ["senior"],
        },
      },
    });

    const results = await searchManager.searchByUser(
      createUserSearchParams(u1.userId, {
        excludedContextFields: ["languages"],
        recencyThresholdMonths: 24,
      }),
    );

    console.log("[G3] Results count:", results.length);
    console.log(
      "[G3] Waymates:",
      results
        .filter((r) => r.candidateType === "waymate")
        .map((r) => ({
          userId: r.userId,
          position: r.matchedContext.position,
        })),
    );

    // Assert - U2 is marked as waymate (same goal as U1)
    const u2Result = results.find((r) => r.userId === u2.userId);
    expect(u2Result).toBeDefined();
    expect(u2Result?.candidateType).toBe("waymate");

    console.log("[G3] U2 marked as waymate: ✅");
  });

  // Business rule: Pathfinder gets scoring bonus (contextMatchScore > 0)
  it("G4: Goal affects scoring - Pathfinder gets bonus to contextMatchScore", async () => {
    const db = new DatabaseContext(driver);
    const goalsManager = new GoalsManager(db);
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new UserStories();

    const u1 = dataManager.getStoryBy("U1");

    console.log("[G4] Creating goal for U1: Senior position");

    await goalsManager.setGoal({
      userId: u1.userId,
      targetContext: {
        position: {
          mode: "desired",
          values: ["senior"],
        },
      },
    });

    const searchParams = createUserSearchParams(u1.userId, {
      excludedContextFields: ["position", "birthYear", "languages"],
      recencyThresholdMonths: 24,
    });
    const results = await searchManager.searchByUser(searchParams);

    // Find pathfinders and non-pathfinders
    const pathfinders = results.filter((r) => r.candidateType === "pathfinder");
    const regularCandidates = results.filter((r) => r.candidateType === null);

    console.log("[G4] Pathfinders count:", pathfinders.length);
    console.log("[G4] Regular candidates count:", regularCandidates.length);

    // Assert - At least one pathfinder exists
    expect(pathfinders.length).toBeGreaterThan(0);

    // Assert - Pathfinders have contextMatchScore (scoring is applied)
    pathfinders.forEach((p) => {
      expect(p.contextMatchScore).toBeDefined();
      expect(p.contextMatchScore).toBeGreaterThan(0);
    });

    console.log(
      "[G4] Pathfinder scores:",
      pathfinders.map((p) => ({
        userId: p.userId,
        score: p.contextMatchScore,
      })),
    );

    console.log("[G4] Pathfinder scoring verified: ✅");
  });

  // Business rule: Goals work with trajectory search (DTW + candidateType)
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
      targetContext: {
        position: {
          mode: "desired",
          values: ["senior"],
        },
      },
    });

    const results = await searchManager.searchByUser(
      createUserSearchParams(u10.userId, {
        excludedContextFields: [],
        recencyThresholdMonths: 48,
      }),
    );

    console.log("[G5] Results count:", results.length);
    console.log(
      "[G5] Candidates with types:",
      results.slice(0, 5).map((r) => ({
        userId: r.userId,
        candidateType: r.candidateType,
        trajectoryLength: r.path?.length || 0,
      })),
    );

    // Assert - Only pathfinder/waymate candidates returned (null filtered out by goal)
    expect(results.length).toBeGreaterThan(0);
    results.forEach((r) => {
      expect(r.candidateType === "pathfinder" || r.candidateType === "waymate").toBe(true);
    });

    // Assert - If pathfinders exist, they should be properly detected
    const pathfinders = results.filter((r) => r.candidateType === "pathfinder");
    if (pathfinders.length > 0) {
      console.log("[G5] Found pathfinders:", pathfinders.length);
      pathfinders.forEach((p) => {
        expect(p.matchedContext.position).toBe("senior");
      });
    }

    console.log("[G5] Goals + trajectory integration verified: ✅");
  });
});
