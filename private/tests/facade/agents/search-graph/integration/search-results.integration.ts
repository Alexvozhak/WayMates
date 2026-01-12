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
   * - Turn 2: "save" → set_goal → asking_search_mode (new flow!)
   * - Turn 3: "проводники" → search_pathfinders → showing_results
   * - Turn 4: "покажи без учёта индустрии" → apply_filters → search → showing_results
   *
   * Then:
   * - Turn 4: phase = showing_results (NOT showing_exploration!)
   * - Turn 4: appliedFilters.excludedContextFields contains "industry"
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

    console.log("TC-SG-SR2 [1/4]: ✅ Goal shown for review");

    // Turn 2: Confirm → asking_search_mode (new flow)
    const turn2 = await runGraph("save");
    expect(turn2.phase, "Turn 2: After confirm, user MUST choose search mode").toBe(PHASE.asking_search_mode);

    console.log("TC-SG-SR2 [2/4]: ✅ Asking search mode");

    // Turn 3: Choose mode → showing_pathfinder_results
    const turn3 = await runGraph("проводники");
    expect(turn3.phase, "Turn 3: After mode selection, user MUST see search results").toBe(
      PHASE.showing_pathfinder_results,
    );

    if (turn3.phase !== PHASE.showing_pathfinder_results) {
      expect.fail("Type guard failed after strict assertion");
    }

    const resultsBeforeFilter = turn3.results.length;
    console.log(`TC-SG-SR2 [3/4]: ✅ Search results (${resultsBeforeFilter} results)`);

    // Turn 4: Apply filter intent → should stay in search results (not exploration)
    const turn4 = await runGraph("покажи без учёта индустрии");

    expect(
      turn4.phase,
      "Turn 4: Filter intent WITH goal MUST return to search results (not exploration). " +
        "If showing_exploration, check routeAfterApplyFilters — should route to search when storedGoal present",
    ).toBe(PHASE.showing_pathfinder_results);

    if (turn4.phase !== PHASE.showing_pathfinder_results) {
      expect.fail("Type guard failed after strict assertion");
    }

    expect(turn4.appliedFilters, "Turn 4: appliedFilters MUST be present").toBeDefined();

    const excludedFields = turn4.appliedFilters?.excludedContextFields ?? [];
    const hasIndustryExcluded = excludedFields.some((f) => f.toLowerCase().includes("industry"));

    expect(
      hasIndustryExcluded,
      `Turn 4: LLM MUST extract "industry" from filter message, got: ${JSON.stringify(excludedFields)}`,
    ).toBe(true);

    console.log(`TC-SG-SR2 [4/4]: ✅ Filter applied → search results (${turn4.results.length} results)`);
    console.log(`  Excluded fields: ${excludedFields.join(", ")}`);
  }, 300_000);
});
