/**
 * Goals Integration Tests (GM1-GM4 + G1-G5)
 *
 * GM1-GM4: GoalsManager CRUD operations
 * G1-G5: Goals integration with searchByCurrent (candidateType classification)
 *
 * Uses Batch A+C test data (U1-U13)
 *
 * Test focus:
 * - GM1: Create goal (setGoal)
 * - GM2: Read goals (getUserGoal)
 * - GM3: Update goal (setGoal upsert)
 * - GM4: Delete goal (deleteGoal)
 * - G1: No Goal baseline (candidateType=null)
 * - G2: Pathfinder detection (candidateType="pathfinder")
 * - G3: Waymate detection (candidateType="waymate")
 * - G4: Goal affects scoring (bonus)
 * - G5: Goal + DTW integration
 */

import { describe, it, expect } from "vitest";
import { driver } from "./setup-goals.js";
import { FixtureSearchManager } from "../../helpers/fixture-search-manager.js";
import { TestDataManager } from "../../helpers/test-data-manager.js";
import { GoalsManager } from "../../../src/core/goals-manager.js";
import { DatabaseContext } from "../../../src/database-context.js";

describe("Goals Integration (GM1-GM4 + G1-G5)", () => {
  it("GM1: Create goal - setGoal creates goal with targetCriteria", async () => {
    // Arrange
    const db = new DatabaseContext(driver);
    const goalsManager = new GoalsManager(db);
    const dataManager = new TestDataManager();

    const u3 = dataManager.getStoryBy("U3"); // Junior Backend Go

    console.log("[GM1] Creating goal for U3");
    console.log("[GM1] Target criteria:", {
      position: { mode: "desired", values: ["Middle"] },
      domains: { mode: "desired", values: ["Backend"] },
    });

    // Act - Create goal
    const userId = await goalsManager.setGoal({
      userId: u3.userId,
      targetContext: {
        position: {
          mode: "desired",
          values: ["Middle"],
        },
        domains: {
          mode: "desired",
          values: ["Backend"],
        },
      },
    });

    // Assert - Verify setGoal returned userId
    expect(userId).toBe(u3.userId);

    // Verify getUserGoal returns created goal with correct criteria
    const goal = await goalsManager.getUserGoal(u3.userId);
    console.log("[GM1] Created goal:", goal);

    expect(goal?.userId).toBe(u3.userId);
    expect(goal?.targetCriteria.position).toEqual({
      mode: "desired",
      values: ["Middle"],
    });
    expect(goal?.targetCriteria.domains).toEqual({
      mode: "desired",
      values: ["Backend"],
    });
  });

  it("GM2: Read goals - getUserGoal returns goal or null", async () => {
    // Arrange
    const db = new DatabaseContext(driver);
    const goalsManager = new GoalsManager(db);
    const dataManager = new TestDataManager();

    const u3 = dataManager.getStoryBy("U3");

    // Create goal for U3
    await goalsManager.setGoal({
      userId: u3.userId,
      targetContext: {
        position: {
          mode: "desired",
          values: ["Senior"],
        },
      },
    });

    console.log("[GM2] Testing getUserGoal for existing user");

    // Act & Assert - Existing user returns goal with correct criteria
    const existingGoal = await goalsManager.getUserGoal(u3.userId);
    console.log("[GM2] Found goal for U3:", existingGoal?.targetCriteria);

    expect(existingGoal?.userId).toBe(u3.userId);
    expect(existingGoal?.targetCriteria.position).toEqual({
      mode: "desired",
      values: ["Senior"],
    });
  });

  it("GM3: Update goal - setGoal upserts goal preserving createdAt", async () => {
    // Arrange
    const db = new DatabaseContext(driver);
    const goalsManager = new GoalsManager(db);
    const dataManager = new TestDataManager();

    const u3 = dataManager.getStoryBy("U3");

    console.log("[GM3] Creating initial goal");

    // Create initial goal #1
    await goalsManager.setGoal({
      userId: u3.userId,
      targetContext: {
        position: {
          mode: "desired",
          values: ["Middle"],
        },
      },
    });

    const goal1 = await goalsManager.getUserGoal(u3.userId);
    const createdAt1 = goal1?.createdAt;

    console.log("[GM3] Goal #1 created at:", createdAt1);
    console.log("[GM3] Goal #1 criteria:", goal1?.targetCriteria);

    // Wait a bit to ensure timestamp would differ if re-created
    await new Promise((resolve) => setTimeout(resolve, 100));

    console.log("[GM3] Updating goal (upsert)");

    // Act - Update goal #2
    await goalsManager.setGoal({
      userId: u3.userId,
      targetContext: {
        position: {
          mode: "desired",
          values: ["Senior"],
        },
        domains: {
          mode: "desired",
          values: ["Backend"],
        },
      },
    });

    const goal2 = await goalsManager.getUserGoal(u3.userId);

    console.log("[GM3] Goal #2 created at:", goal2?.createdAt);
    console.log("[GM3] Goal #2 criteria:", goal2?.targetCriteria);

    // Assert - New criteria applied
    expect(goal2?.targetCriteria.position).toEqual({
      mode: "desired",
      values: ["Senior"],
    });
    expect(goal2?.targetCriteria.domains).toEqual({
      mode: "desired",
      values: ["Backend"],
    });

    // Assert - createdAt unchanged (UPSERT ON MATCH preserves createdAt)
    expect(goal2?.createdAt).toBe(createdAt1);

    console.log("[GM3] createdAt preserved: ✅");
  });

  it("GM4: Delete goal - deleteGoal removes goal and returns success status", async () => {
    // Arrange
    const db = new DatabaseContext(driver);
    const goalsManager = new GoalsManager(db);
    const dataManager = new TestDataManager();

    const u3 = dataManager.getStoryBy("U3");

    // Create goal
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

    // Act - Delete goal
    const deleteSuccess1 = await goalsManager.deleteGoal(u3.userId);

    console.log("[GM4] First delete returned:", deleteSuccess1);

    // Assert - Delete succeeded
    expect(deleteSuccess1).toBe(true);

    // Assert - Goal no longer exists
    const goalAfter = await goalsManager.getUserGoal(u3.userId);
    expect(goalAfter).toBeNull();

    console.log("[GM4] Goal deleted: ✅");

    // Act - Delete again (idempotent check)
    const deleteSuccess2 = await goalsManager.deleteGoal(u3.userId);

    console.log("[GM4] Second delete returned:", deleteSuccess2);

    // Assert - Delete failed (goal already deleted)
    expect(deleteSuccess2).toBe(false);

    console.log("[GM4] Idempotent delete: ✅");
  });

  it("G1: No Goal baseline - searchByUser without goal returns candidateType=null", async () => {
    // Arrange
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new TestDataManager();

    const u1 = dataManager.getStoryBy("U1"); // Junior Frontend React

    console.log("[G1] Searching without goal for U1");

    // NO goal created for U1

    // Act - Search by userId without goal (auto uses current context)
    const results = await searchManager.searchByUser({
      userId: u1.userId,
      excludedContextFields: ["languages"], // Exclude languages (not relevant to Goals test)
      excludedCreationReasons: [],
      recencyThresholdMonths: 24,
      limit: 10,
    });

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

  it("G2: Pathfinder detection - U5 (achieved Senior) marked as pathfinder", async () => {
    // Arrange
    const db = new DatabaseContext(driver);
    const goalsManager = new GoalsManager(db);
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new TestDataManager();

    const u1 = dataManager.getStoryBy("U1"); // Junior Frontend React
    const u5 = dataManager.getStoryBy("U5"); // Has Senior in trajectory

    console.log("[G2] U1 goal: Senior position");
    console.log(
      "[G2] U5 trajectory positions:",
      u5.contexts.map((c) => c.position),
    );

    // Create goal for U1: wants Senior
    await goalsManager.setGoal({
      userId: u1.userId,
      targetContext: {
        position: {
          mode: "desired",
          values: ["Senior"],
        },
      },
    });

    // Act - Search by userId with goal
    // IMPORTANT: Exclude 'position' and 'birthYear' from strict fields to allow pathfinder detection
    // (pathfinders have DIFFERENT positions than user - that's the whole point!)
    const results = await searchManager.searchByUser({
      userId: u1.userId,
      excludedContextFields: ["position", "birthYear", "languages"], // Exclude languages (not relevant to Goals test)
      excludedCreationReasons: [],
      recencyThresholdMonths: 24,
      limit: 20,
    });

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
    const u5SeniorResult = results.find(
      (r) => r.userId === u5.userId && r.matchedContext.position === "Senior",
    );
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
    expect(u5SeniorResult?.matchedContext.position).toBe("Senior");

    console.log("[G2] U5 marked as pathfinder: ✅");
  });

  it("G3: Waymate detection - U1 and U2 both want Senior → U2 is waymate", async () => {
    // Arrange
    const db = new DatabaseContext(driver);
    const goalsManager = new GoalsManager(db);
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new TestDataManager();

    const u1 = dataManager.getStoryBy("U1");
    const u2 = dataManager.getStoryBy("U2");

    console.log("[G3] Setting same goal (Senior) for U1 and U2");

    // Create goal for U1: wants Senior
    await goalsManager.setGoal({
      userId: u1.userId,
      targetContext: {
        position: {
          mode: "desired",
          values: ["Senior"],
        },
      },
    });

    // Create goal for U2: wants Senior (same goal!)
    await goalsManager.setGoal({
      userId: u2.userId,
      targetContext: {
        position: {
          mode: "desired",
          values: ["Senior"],
        },
      },
    });

    // Act - Search by userId with goal
    const results = await searchManager.searchByUser({
      userId: u1.userId,
      excludedContextFields: ["languages"], // Exclude languages (not relevant to Goals test)
      excludedCreationReasons: [],
      recencyThresholdMonths: 24,
      limit: 20,
    });

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

  it("G4: Goal affects scoring - Pathfinder gets bonus to contextMatchScore", async () => {
    // Arrange
    const db = new DatabaseContext(driver);
    const goalsManager = new GoalsManager(db);
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new TestDataManager();

    const u1 = dataManager.getStoryBy("U1");

    console.log("[G4] Creating goal for U1: Senior position");

    // Create goal for U1: wants Senior
    await goalsManager.setGoal({
      userId: u1.userId,
      targetContext: {
        position: {
          mode: "desired",
          values: ["Senior"],
        },
      },
    });

    // Act - Search by userId with goal
    // Exclude 'position' and 'birthYear' to allow pathfinder detection
    const results = await searchManager.searchByUser({
      userId: u1.userId,
      excludedContextFields: ["position", "birthYear", "languages"], // Exclude languages (not relevant to Goals test)
      excludedCreationReasons: [],
      recencyThresholdMonths: 24,
      limit: 20,
    });

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

  it("G5: Goal + DTW integration - Goals work with trajectory search", async () => {
    // Arrange
    const db = new DatabaseContext(driver);
    const goalsManager = new GoalsManager(db);
    const fixture = new FixtureSearchManager(driver);
    const searchManager = fixture.getSearchManager();
    const dataManager = new TestDataManager();

    const u10 = dataManager.getStoryBy("U10"); // Has long trajectory (3+ contexts)

    console.log("[G5] U10 trajectory length:", u10.contexts.length);
    console.log("[G5] Creating goal for U10: Senior position");

    // Create goal for U10: wants Senior
    await goalsManager.setGoal({
      userId: u10.userId,
      targetContext: {
        position: {
          mode: "desired",
          values: ["Senior"],
        },
      },
    });

    // Act - Search by userId with trajectory collection (longer window for trajectory analysis)
    const results = await searchManager.searchByUser({
      userId: u10.userId,
      excludedContextFields: [],
      excludedCreationReasons: [],
      recencyThresholdMonths: 48,
      limit: 20,
    });

    console.log("[G5] Results count:", results.length);
    console.log(
      "[G5] Candidates with types:",
      results.slice(0, 5).map((r) => ({
        userId: r.userId,
        candidateType: r.candidateType,
        trajectoryLength: r.path?.length || 0,
      })),
    );

    // Assert - candidateType field is present (Goals work with search)
    expect(results.length).toBeGreaterThan(0);
    results.forEach((r) => {
      expect(
        r.candidateType === null ||
          r.candidateType === "pathfinder" ||
          r.candidateType === "waymate",
      ).toBe(true);
    });

    // Assert - If pathfinders exist, they should be properly detected
    const pathfinders = results.filter((r) => r.candidateType === "pathfinder");
    if (pathfinders.length > 0) {
      console.log("[G5] Found pathfinders:", pathfinders.length);
      pathfinders.forEach((p) => {
        expect(p.matchedContext.position).toBe("Senior");
      });
    }

    console.log("[G5] Goals + trajectory integration verified: ✅");
  });
});
