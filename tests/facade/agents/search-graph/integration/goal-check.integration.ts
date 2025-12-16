import { beforeEach, describe, expect, it } from "vitest";

import { PHASE } from "../../../../../src/facade/langGraph/search-graph/search-graph.js";
import { FacadeTestContext } from "../../../helpers/test-context.js";
import {
  cleanupUserGoal,
  runSearchGraphWithRelaxedFilters,
  setupUserWithGoal,
  TEST_USER_ID,
} from "../helpers/search-graph-helpers.js";

import type { UserId } from "../../../../../src/shared/schemas.js";

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
    ).toBe(PHASE.showingExploration);

    if (response.phase !== PHASE.showingExploration) {
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
   * TC-SG-GC2: Has goal → search directly
   *
   * Что тестируем:
   * Пользователь с существующей целью пропускает explore и сразу видит результаты.
   * Graph направляет в search node (routing logic).
   * Тест использует relaxed filters для matching с fixtures.
   *
   * Given:
   * - User: U1
   * - Goal: position = ["senior"] в Neo4j
   *
   * Then:
   * - Phase: showing_results (NO exploration phase, routing correctness)
   * - results.length > 0 (relaxed filters allow matching)
   *
   * Тип теста: Integration (real LLM, relaxed filters via helper)
   */
  it("TC-SG-GC2: has goal → search directly", async () => {
    // Given
    const ctx = FacadeTestContext.getInstance();

    await setupUserWithGoal(ctx.coreClient, {
      userId: testUserId,
      targetContext: {
        position: {
          mode: "desired",
          values: ["senior"],
        },
      },
    });

    const goal = await ctx.coreClient.client.goal.getByUser.query({ userId: testUserId });
    expect(goal, "Goal must exist before test").not.toBeNull();

    // When
    const response = await runGraph("покажи результаты");

    // Then: routing correctness (phase is the key assertion)
    expect(
      response.phase,
      "User with goal MUST skip exploration and show results directly. " +
        "If this fails, check: (1) check_goal routing, (2) existingGoal loading",
    ).toBe(PHASE.showingResults);

    if (response.phase !== PHASE.showingResults) {
      expect.fail("Type guard failed after strict assertion");
    }

    // With relaxed filters, we should get matching results
    expect(
      response.results.length,
      "Search with relaxed filters MUST return results (excludes geo/personal fields)",
    ).toBeGreaterThan(0);

    console.log(`TC-SG-GC2: ✅ User with goal → search (${response.results.length} results)`);
  }, 120_000);
});
