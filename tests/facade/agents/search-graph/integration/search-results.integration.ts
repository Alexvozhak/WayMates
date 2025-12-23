import { beforeEach, describe, expect, it } from "vitest";

import { PHASE } from "../../../../../src/facade/langGraph/search-graph/search-graph.js";
import { FacadeTestContext } from "../../../helpers/test-context.js";
import {
  cleanupUserGoal,
  runSearchGraphWithRelaxedFilters,
  setupUserWithGoal,
  TEST_USER_ID,
} from "../helpers/search-graph-helpers.js";
import { targetContextSchema } from "../../../../../src/shared/schemas.js";

import type { UserId } from "../../../../../src/shared/schemas.js";

describe("SearchGraph: Search Results (TC-SG-SR)", () => {
  const testUserId: UserId = TEST_USER_ID;
  const threadId = `search_graph_sr_${testUserId}`;

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
   * TC-SG-SR2: Filter intent → apply_filters → search (has goal)
   *
   * Что тестируем:
   * Пользователь с сохранённой целью и результатами применяет фильтры.
   * apply_filters node ДОЛЖЕН вернуть в search (не в explore).
   *
   * Инвариант: I14 — apply_filters С целью → search
   *
   * Given:
   * - User: U1 с goal в Neo4j
   *
   * Flow:
   * - Turn 1: "покажи результаты" → load_existing_goal → show_goal
   * - Turn 2: "save" → set_goal → search → showing_results
   * - Turn 3: "покажи без учёта индустрии" → apply_filters → search → showing_results
   *
   * Then:
   * - Turn 3: phase = showing_results (NOT showing_exploration!)
   * - Turn 3: appliedCurrentFilters.excludedContextFields contains "industry"
   *
   * Тип теста: Integration (multi-turn, real LLM)
   */
  it("TC-SG-SR2: filter intent → apply_filters → search (has goal)", async () => {
    const ctx = FacadeTestContext.getInstance();

    // Setup: create goal
    await setupUserWithGoal(ctx.coreClient, {
      userId: testUserId,
      targetContext: targetContextSchema.parse({
        position: { mode: "desired", values: ["senior"] },
        domains: { mode: "desired", values: ["backend"] },
      }),
    });

    const goal = await ctx.coreClient.client.goal.getByUser.query({ userId: testUserId });
    expect(goal, "Goal must exist before test").not.toBeNull();

    // Turn 1: User with goal sees goal for review
    const turn1 = await runGraph("покажи результаты");
    expect(turn1.phase, "Turn 1: User with goal MUST see goal for review first").toBe(PHASE.showing_goal);

    console.log("TC-SG-SR2 [1/3]: ✅ Goal shown for review");

    // Turn 2: Confirm to get search results
    const turn2 = await runGraph("save");
    expect(turn2.phase, "Turn 2: After confirm, user MUST see search results").toBe(PHASE.showing_results);

    if (turn2.phase !== PHASE.showing_results) {
      expect.fail("Type guard failed after strict assertion");
    }

    const resultsBeforeFilter = turn2.results.length;
    console.log(`TC-SG-SR2 [2/3]: ✅ Search results (${resultsBeforeFilter} results)`);

    // Turn 3: Apply filter intent → should stay in search results (not exploration)
    const turn3 = await runGraph("покажи без учёта индустрии");

    expect(
      turn3.phase,
      "Turn 3: Filter intent WITH goal MUST return to search results (not exploration). " +
        "If showing_exploration, check routeAfterApplyFilters — should route to search when storedGoal present",
    ).toBe(PHASE.showing_results);

    if (turn3.phase !== PHASE.showing_results) {
      expect.fail("Type guard failed after strict assertion");
    }

    expect(turn3.appliedCurrentFilters, "Turn 3: appliedCurrentFilters MUST be present").toBeDefined();

    const excludedFields = turn3.appliedCurrentFilters?.excludedContextFields ?? [];
    const hasIndustryExcluded = excludedFields.some((f) => f.toLowerCase().includes("industry"));

    expect(
      hasIndustryExcluded,
      `Turn 3: LLM MUST extract "industry" from filter message, got: ${JSON.stringify(excludedFields)}`,
    ).toBe(true);

    console.log(`TC-SG-SR2 [3/3]: ✅ Filter applied → search results (${turn3.results.length} results)`);
    console.log(`  Excluded fields: ${excludedFields.join(", ")}`);
  }, 240_000);
});
