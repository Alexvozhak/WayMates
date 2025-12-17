import { beforeEach, describe, expect, it } from "vitest";

import { GRAPH_INTENT } from "../../../../../src/facade/services/orchestrator/intent-classifier.js";
import { PHASE } from "../../../../../src/facade/langGraph/search-graph/search-graph.js";
import { FacadeTestContext } from "../../../helpers/test-context.js";
import { cleanupUserGoal, runSearchGraphWithRelaxedFilters, TEST_USER_ID } from "../helpers/search-graph-helpers.js";

import type { UserId } from "../../../../../src/shared/schemas.js";
import type { UserIntent } from "../../../../../src/facade/services/orchestrator/intent-classifier.js";

describe("SearchGraph: E2E (TC-SG-E2E)", () => {
  const testUserId: UserId = TEST_USER_ID;
  const threadId = `search_graph_e2e_${testUserId}`;

  const runGraph = (message: string, intent: UserIntent | null = null) => {
    const ctx = FacadeTestContext.getInstance();
    return runSearchGraphWithRelaxedFilters(ctx.getGraphDeps(), message, threadId, testUserId, intent);
  };

  beforeEach(async () => {
    const ctx = FacadeTestContext.getInstance();
    await ctx.checkpointService.delete(threadId);
    await cleanupUserGoal(ctx.coreClient, testUserId);
  });

  /* eslint-disable complexity -- E2E test covers full multi-turn flow (adhoc → explore → extract → save → search), complexity unavoidable */
  /**
   * TC-SG-E2E-01: Full happy path with adhoc context → goal formation → results
   *
   * Что тестируем:
   * Полный E2E flow SearchGraph в adhoc режиме (без сохранённого контекста).
   * User приходит, даёт adhoc контекст, формирует цель, получает результаты.
   *
   * Given:
   * - User: БЕЗ сохранённого контекста (adhoc режим)
   * - Intent: startAdhoc (pre-parsed)
   *
   * Flow:
   * - Turn 1: "Я junior backend разработчик" (startAdhoc intent)
   *   → load_context извлекает adhocContext через LLM
   *   → explore → showing_exploration
   *
   * - Turn 2: "Хочу стать middle backend разработчиком"
   *   → extract_goal → showing_goal
   *
   * - Turn 3: "сохрани"
   *   → set_goal → search → showing_results
   *
   * Then:
   * - Turn 1: phase = showing_exploration
   * - Turn 1: candidates.length > 0 (adhoc search works)
   *
   * - Turn 2: phase = showing_goal
   * - Turn 2: extractedGoal.position contains "middle"
   * - Turn 2: extractedGoal.domain contains "backend"
   *
   * - Turn 3: phase = showing_results
   * - Turn 3: results.length >= 2 && <= 5 (multiple pathfinders found)
   * - Turn 3: goal saved to Neo4j
   * - Turn 3: all results are pathfinders (achieved middle backend)
   *
   * Тип теста: E2E Integration (adhoc mode + multi-turn + LLM + Neo4j + search)
   *
   * Почему НЕ проверяем конкретных userId:
   * - Fixtures содержат 8+ кандидатов с middle backend траекториями
   * - Scoring может вернуть любых из них в зависимости от skills matching
   * - Integration test не должен быть хрупким к конкретным fixtures
   * - Проверяем КОЛИЧЕСТВО и КАЧЕСТВО результатов, не конкретные userId
   */
  it("TC-SG-E2E-01: adhoc context → goal formation → search results", async () => {
    const ctx = FacadeTestContext.getInstance();

    // Pre-check: no goal exists
    let goal = await ctx.coreClient.client.goal.getByUser.query({ userId: testUserId });
    expect(goal, "Goal must be absent before test").toBeNull();

    // ================================================================================
    // Turn 1: adhoc context extraction (startAdhoc intent → LLM extraction)
    // ================================================================================
    const turn1 = await runGraph("Я junior backend разработчик", GRAPH_INTENT.startAdhoc);

    expect(
      turn1.phase,
      "Turn 1: adhoc mode MUST start with exploration (load_context extracts adhocContext via LLM)",
    ).toBe(PHASE.showingExploration);

    if (turn1.phase !== PHASE.showingExploration) {
      expect.fail("Type guard failed after strict assertion");
    }

    expect(
      turn1.candidates.length,
      "Turn 1: Exploration MUST return candidates with relaxed filters (adhoc search works)",
    ).toBeGreaterThan(0);

    console.log(`Turn 1: ✅ adhoc extraction → exploration (${turn1.candidates.length} candidates)`);

    // ================================================================================
    // Turn 2: Goal formation (extract_goal)
    // ================================================================================
    const turn2 = await runGraph("Хочу стать middle backend разработчиком");

    expect(
      turn2.phase,
      "Turn 2: After user expresses goal, MUST extract and show goal",
    ).toBe(PHASE.showingGoal);

    if (turn2.phase !== PHASE.showingGoal) {
      expect.fail("Type guard failed after strict assertion");
    }

    // Verify LLM extraction: position "middle"
    const positionValues = turn2.extractedGoal.position?.values ?? [];
    expect(
      positionValues.some((v) => v.toLowerCase().includes("middle")),
      `Turn 2: LLM MUST extract "middle" from message, got: ${JSON.stringify(positionValues)}`,
    ).toBe(true);

    // Verify LLM extraction: domains "backend"
    const domainValues = turn2.extractedGoal.domains?.values ?? [];
    expect(
      domainValues.some((v: string) => v.toLowerCase().includes("backend")),
      `Turn 2: LLM MUST extract "backend" from message, got: ${JSON.stringify(domainValues)}`,
    ).toBe(true);

    console.log(`Turn 2: ✅ Goal extracted (position: ${positionValues}, domain: ${domainValues})`);

    // ================================================================================
    // Turn 3: Save goal + Search (set_goal → search → showing_results)
    // ================================================================================
    const turn3 = await runGraph("сохрани");

    expect(
      turn3.phase,
      "Turn 3: Save intent MUST persist goal to Neo4j and show search results",
    ).toBe(PHASE.showingResults);

    if (turn3.phase !== PHASE.showingResults) {
      expect.fail("Type guard failed after strict assertion");
    }

    // Verify: goal persisted to Neo4j
    goal = await ctx.coreClient.client.goal.getByUser.query({ userId: testUserId });
    expect(goal, "Goal MUST be saved to Neo4j after 'save' command").not.toBeNull();

    const savedPositionValues = goal?.targetCriteria.position?.values ?? [];
    expect(
      savedPositionValues.some((v) => v.toLowerCase().includes("middle")),
      `Expected saved goal to contain "middle", got: ${JSON.stringify(savedPositionValues)}`,
    ).toBe(true);

    // Verify: search results returned
    expect(
      turn3.results.length,
      "Turn 3: Search MUST return at least 2 pathfinders (relaxed filters allow multiple matches). " +
        "Fixtures contain 8+ candidates with middle backend trajectories (U3, U8, U10, U11, U15, U17, U19, ...).",
    ).toBeGreaterThanOrEqual(2);

    expect(
      turn3.results.length,
      "Turn 3: Search SHOULD NOT return too many results (sanity check for scoring). " +
        "If this fails, check if relaxed filters are TOO relaxed or scoring is broken.",
    ).toBeLessThanOrEqual(5);

    // Verify: all results are pathfinders (achieved middle backend)
    turn3.results.forEach((result, idx) => {
      const path = result.path ?? [];
      const hasMiddleBackend = path.some((ctx: { position: string; domains: string[] }) => {
        const isMiddle = ctx.position === "middle";
        const isBackend = ctx.domains.some((d: string) => d.toLowerCase() === "backend");
        return isMiddle && isBackend;
      });

      expect(
        hasMiddleBackend,
        `Result ${idx} (userId: ${result.userId}) MUST be a pathfinder (has middle backend in path). ` +
          `Path: ${JSON.stringify(path.map((c: { position: string; domains: string[] }) => ({ position: c.position, domains: c.domains })))}`,
      ).toBe(true);
    });

    console.log(
      `Turn 3: ✅ E2E complete! Results: ${turn3.results.length} pathfinders found, goal saved to Neo4j`,
    );
    console.log(
      `  Pathfinders: ${turn3.results.map((r) => `${r.userId.slice(0, 8)}...`).join(", ")}`,
    );
  }, 240_000); // 4 minutes timeout for multi-turn LLM calls
});
