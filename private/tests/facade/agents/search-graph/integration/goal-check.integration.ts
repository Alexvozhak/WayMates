import { targetContextSchema } from "@shared/schemas.js";
import { beforeEach, describe, expect, it } from "vitest";

import { PHASE } from "../../../../../../src/facade/langGraph/search-graph/search-graph.js";
import { FacadeTestContext } from "../../../helpers/test-context.js";
import {
  cleanupUserGoal,
  runSearchGraphWithRelaxedFilters,
  setupUserWithGoal,
  TEST_USER_ID,
} from "../helpers/search-graph-helpers.js";

import type { UserId } from "@shared/schemas.js";

describe("SearchGraph: Goal Check (TC-SG-GC)", () => {
  const testUserId: UserId = TEST_USER_ID;
  const threadId = `search_graph_${testUserId}`;

  const runGraph = (message: string) => {
    const ctx = FacadeTestContext.getInstance();
    return runSearchGraphWithRelaxedFilters(ctx.getGraphDeps(), message, threadId, testUserId);
  };

  beforeEach(async () => {
    const ctx = FacadeTestContext.getInstance();
    await ctx.checkpointService.delete(threadId);
    await cleanupUserGoal(ctx.coreClient, testUserId);
  });

  /**
   * TC-SG-GC1: No goal → explore
   *
   * Что тестируем:
   * Пользователь без сохранённой цели начинает с exploration phase.
   * Graph направляет в explore node (routing logic).
   * Тест использует relaxed filters для matching с fixtures.
   *
   * Given:
   * - User: U1 (без goal в Neo4j)
   * - Message: "хочу найти работу"
   *
   * Then:
   * - Phase: showing_exploration (routing correctness)
   * - candidates.length > 0 (relaxed filters allow matching)
   *
   * Тип теста: Integration (real LLM, relaxed filters via helper)
   */
  it("TC-SG-GC1: no goal → explore", async () => {
    // Given
    const ctx = FacadeTestContext.getInstance();
    const goal = await ctx.coreClient.client.goal.getByUser.query({ userId: testUserId });
    expect(goal, "Goal must be absent before test").toBeNull();

    // When
    const response = await runGraph("хочу найти работу");

    // Then: routing correctness (phase is the key assertion)
    expect(
      response.phase,
      "User without goal MUST start with exploration. " +
        "If this fails, check: (1) check_goal routing, (2) load_context logic",
    ).toBe(PHASE.showing_exploration_candidates);

    if (response.phase !== PHASE.showing_exploration_candidates) {
      expect.fail("Type guard failed after strict assertion");
    }

    // With relaxed filters, we should get matching candidates
    expect(
      response.candidates.length,
      "Exploration with relaxed filters MUST return candidates (excludes geo/personal fields)",
    ).toBeGreaterThan(0);

    console.log(`TC-SG-GC1: ✅ User without goal → explore (${response.candidates.length} candidates)`);
  }, 120_000);

  /**
   * TC-SG-GC2: Has goal → show goal for review → confirm → choose mode → search
   *
   * Что тестируем:
   * Пользователь с существующей целью сначала видит цель для review.
   * После confirm — выбор режима поиска (pathfinders/waymates).
   * После выбора режима — показываются результаты.
   * Тест использует relaxed filters для matching с fixtures.
   *
   * Given:
   * - User: U1
   * - Goal: position = ["senior"] в Neo4j
   *
   * Flow:
   * - Turn 1: "покажи результаты" → load_existing_goal → show_goal (review)
   * - Turn 2: "save" → set_goal → asking_search_mode
   * - Turn 3: "проводники" → search_pathfinders → showing_results
   *
   * Then:
   * - Turn 1: Phase = showing_goal (goal review before search)
   * - Turn 2: Phase = asking_search_mode (choose pathfinders/waymates)
   * - Turn 3: Phase = showing_results, results.length > 0
   *
   * Тип теста: Integration (multi-turn, real LLM, relaxed filters via helper)
   */
  it("TC-SG-GC2: has goal → show goal → confirm → search", async () => {
    // Given
    const ctx = FacadeTestContext.getInstance();

    await setupUserWithGoal(ctx.coreClient, {
      userId: testUserId,
      targetContext: targetContextSchema.parse({
        position: {
          mode: "desired",
          values: ["senior"],
        },
      }),
    });

    const goal = await ctx.coreClient.client.goal.getByUser.query({ userId: testUserId });
    expect(goal, "Goal must exist before test").not.toBeNull();

    // Turn 1: User asks for results, but first sees goal for review
    const turn1 = await runGraph("покажи результаты");
    expect(
      turn1.phase,
      "User with goal MUST see goal for review first. " +
        "If this fails, check: (1) routeAfterCheckGoal → load_existing_goal, (2) load_existing_goal → show_goal edge",
    ).toBe(PHASE.showing_goal);

    if (turn1.phase !== PHASE.showing_goal) {
      expect.fail("Type guard failed after strict assertion");
    }

    console.log("Turn 1: ✅ Goal shown for review");

    // Turn 2: User confirms → asking_search_mode (new flow)
    const turn2 = await runGraph("save");
    expect(
      turn2.phase,
      "After confirm, user MUST choose search mode (pathfinders/waymates). " +
        "If this fails, check: (1) routeAfterSetGoal, (2) set_goal → ask_search_mode edge",
    ).toBe(PHASE.asking_search_mode);

    console.log("Turn 2: ✅ Asking search mode");

    // Turn 3: User chooses pathfinders → showing_pathfinder_results
    const turn3 = await runGraph("проводники");
    expect(
      turn3.phase,
      "After mode selection, user MUST see search results. " +
        "If this fails, check: (1) routeAfterParseSearchModeIntent, (2) search_pathfinders edge",
    ).toBe(PHASE.showing_pathfinder_results);

    if (turn3.phase !== PHASE.showing_pathfinder_results) {
      expect.fail("Type guard failed after strict assertion");
    }

    // With relaxed filters, we should get matching results
    expect(
      turn3.results.length,
      "Search with relaxed filters MUST return results (excludes geo/personal fields)",
    ).toBeGreaterThan(0);

    console.log(`Turn 3: ✅ Search complete (${turn3.results.length} results)`);
  }, 240_000);
});
