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

  /* eslint-disable complexity -- E2E test covers full multi-turn flow (adhoc → confirm → explore → extract → save → search), complexity unavoidable */
  /**
   * TC-SG-E2E-01: Full happy path with adhoc context → confirm → explore → goal → results
   *
   * Что тестируем:
   * Полный E2E flow SearchGraph в adhoc режиме (без сохранённого контекста).
   * User приходит, даёт adhoc контекст, подтверждает, исследует, формирует цель, получает результаты.
   *
   * Given:
   * - User: БЕЗ сохранённого контекста (adhoc режим)
   * - Intent: startAdhoc (pre-parsed)
   *
   * Flow:
   * - Turn 1: "Я junior backend разработчик" (startAdhoc intent)
   *   → load_context извлекает adhocContext через LLM
   *   → confirm_adhoc_context (interrupt: "что дальше?")
   *
   * - Turn 2: "глянуть похожих" (proceed intent, no goal)
   *   → explore → showing_exploration
   *
   * - Turn 3: "Хочу стать middle backend разработчиком"
   *   → extract_goal → showing_goal
   *
   * - Turn 4: "сохрани"
   *   → set_goal → search → showing_results
   *
   * Then:
   * - Turn 1: phase = confirming_adhoc_context
   * - Turn 1: adhocContext.role contains "backend" OR adhocContext.domains contains "backend"
   *
   * - Turn 2: phase = showing_exploration
   * - Turn 2: candidates.length > 0 (adhoc search works)
   *
   * - Turn 3: phase = showing_goal
   * - Turn 3: extractedGoal.position contains "middle"
   *
   * - Turn 4: phase = showing_results
   * - Turn 4: results.length >= 2 && <= 5 (multiple candidates found)
   * - Turn 4: goal saved to Neo4j
   *
   * Тип теста: E2E Integration (adhoc mode + multi-turn + LLM + Neo4j + search)
   */
  it("TC-SG-E2E-01: adhoc context → confirm → explore → goal → search results", async () => {
    const ctx = FacadeTestContext.getInstance();

    // Pre-check: no goal exists
    let goal = await ctx.coreClient.client.goal.getByUser.query({ userId: testUserId });
    expect(goal, "Goal must be absent before test").toBeNull();

    // ================================================================================
    // Turn 1: adhoc context extraction → confirm (startAdhoc intent → LLM extraction)
    // ================================================================================
    const turn1 = await runGraph("Я junior backend разработчик", GRAPH_INTENT.startAdhoc);

    expect(turn1.phase, "Turn 1: adhoc mode MUST confirm extracted context before exploration").toBe(
      PHASE.confirming_adhoc_context,
    );

    if (turn1.phase !== PHASE.confirming_adhoc_context) {
      expect.fail("Type guard failed after strict assertion");
    }

    // Verify LLM extraction worked (backend can be in role or domains)
    const hasBackend =
      turn1.adhocContext?.role?.toLowerCase().includes("backend") ||
      turn1.adhocContext?.domains?.some((d) => d.toLowerCase().includes("backend"));
    expect(
      hasBackend,
      `Turn 1: LLM MUST extract "backend" from message, got: ${JSON.stringify(turn1.adhocContext)}`,
    ).toBe(true);

    console.log(`Turn 1: ✅ adhoc extraction → confirming_adhoc_context (${JSON.stringify(turn1.adhocContext)})`);

    // ================================================================================
    // Turn 2: User wants to explore similar people (proceed without goal)
    // ================================================================================
    const turn2 = await runGraph("глянуть похожих");

    expect(turn2.phase, "Turn 2: After confirm with 'explore' intent, MUST show exploration").toBe(
      PHASE.showing_exploration_candidates,
    );

    if (turn2.phase !== PHASE.showing_exploration_candidates) {
      expect.fail("Type guard failed after strict assertion");
    }

    expect(
      turn2.candidates.length,
      "Turn 2: Exploration MUST return candidates with relaxed filters (adhoc search works)",
    ).toBeGreaterThan(0);

    console.log(`Turn 2: ✅ explore → showing_exploration (${turn2.candidates.length} candidates)`);

    // ================================================================================
    // Turn 3: Goal formation (extract_goal)
    // ================================================================================
    const turn3 = await runGraph("Хочу стать middle backend разработчиком");

    expect(turn3.phase, "Turn 3: After user expresses goal, MUST extract and show goal").toBe(PHASE.showing_goal);

    if (turn3.phase !== PHASE.showing_goal) {
      expect.fail("Type guard failed after strict assertion");
    }

    // Verify LLM extraction: position "middle"
    const positionValues = turn3.extractedGoal.position?.values ?? [];
    expect(
      positionValues.some((v) => v.toLowerCase().includes("middle")),
      `Turn 3: LLM MUST extract "middle" from message, got: ${JSON.stringify(positionValues)}`,
    ).toBe(true);

    console.log(`Turn 3: ✅ Goal extracted (position: ${positionValues})`);

    // ================================================================================
    // Turn 4: Save goal + Search (set_goal → search → showing_results)
    // ================================================================================
    const turn4 = await runGraph("сохрани");

    expect(turn4.phase, "Turn 4: Save intent MUST persist goal to Neo4j and show search results").toBe(
      PHASE.showing_results,
    );

    if (turn4.phase !== PHASE.showing_results) {
      expect.fail("Type guard failed after strict assertion");
    }

    // Verify: goal persisted to Neo4j
    goal = await ctx.coreClient.client.goal.getByUser.query({ userId: testUserId });
    expect(goal, "Goal MUST be saved to Neo4j after 'save' command").not.toBeNull();

    const savedPositionValues = goal?.targetContext.position?.values ?? [];
    expect(
      savedPositionValues.some((v) => v.toLowerCase().includes("middle")),
      `Expected saved goal to contain "middle", got: ${JSON.stringify(savedPositionValues)}`,
    ).toBe(true);

    // Verify: search results returned
    expect(
      turn4.results.length,
      "Turn 4: Search MUST return at least 2 pathfinders (relaxed filters allow multiple matches). " +
        "Fixtures contain 8+ candidates with middle backend trajectories (U3, U8, U10, U11, U15, U17, U19, ...).",
    ).toBeGreaterThanOrEqual(2);

    expect(
      turn4.results.length,
      "Turn 4: Search SHOULD NOT return too many results (sanity check for scoring). " +
        "If this fails, check if relaxed filters are TOO relaxed or scoring is broken.",
    ).toBeLessThanOrEqual(5);

    console.log(`Turn 4: ✅ E2E complete! Results: ${turn4.results.length} candidates found, goal saved to Neo4j`);
    console.log(`  Candidates: ${turn4.results.map((r) => `${r.userId.slice(0, 8)}...`).join(", ")}`);
  }, 300_000); // 5 minutes timeout for 4-turn LLM calls

  /**
   * TC-SG-E2E-02: No context extracted → asking_adhoc_context
   *
   * Что тестируем:
   * Когда пользователь пишет команду без контекста, система должна спросить.
   *
   * Given:
   * - User: без сохранённого контекста
   * - Message: "Давай быстрый поиск" (команда, не самоописание)
   *
   * Flow:
   * - Turn 1: команда без контекста → LLM extraction = null → asking_adhoc_context
   * - Turn 2: "Я senior frontend" → extraction → confirming_adhoc_context
   *
   * Then:
   * - Turn 1: phase = asking_adhoc_context
   * - Turn 2: phase = confirming_adhoc_context, adhocContext содержит frontend
   */
  it("TC-SG-E2E-02: no context → asking_adhoc_context → provide context → confirm", async () => {
    const ctx = FacadeTestContext.getInstance();
    await ctx.checkpointService.delete(threadId);

    // ================================================================================
    // Turn 1: Command without context → should ask for context
    // ================================================================================
    const turn1 = await runGraph("Давай быстрый поиск", GRAPH_INTENT.startAdhoc);

    expect(
      turn1.phase,
      "Turn 1: Command without self-description MUST ask for context (LLM should NOT hallucinate)",
    ).toBe(PHASE.asking_adhoc_context);

    console.log(`Turn 1: ✅ No context extracted → asking_adhoc_context`);

    // ================================================================================
    // Turn 2: User provides context → should confirm
    // ================================================================================
    const turn2 = await runGraph("Я senior frontend разработчик");

    expect(turn2.phase, "Turn 2: After user provides context, MUST confirm extracted context").toBe(
      PHASE.confirming_adhoc_context,
    );

    if (turn2.phase !== PHASE.confirming_adhoc_context) {
      expect.fail("Type guard failed after strict assertion");
    }

    const hasFrontend =
      turn2.adhocContext?.role?.toLowerCase().includes("frontend") ||
      turn2.adhocContext?.domains?.some((d) => d.toLowerCase().includes("frontend"));
    expect(hasFrontend, `Turn 2: MUST extract "frontend", got: ${JSON.stringify(turn2.adhocContext)}`).toBe(true);

    console.log(`Turn 2: ✅ Context extracted → confirming_adhoc_context`);
  }, 120_000);
});
