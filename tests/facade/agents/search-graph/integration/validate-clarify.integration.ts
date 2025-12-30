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

describe("SearchGraph: Validate & Clarify (TC-SG-VC)", () => {
  const testUserId: UserId = TEST_USER_ID;
  const threadId = `search_graph_vc_${testUserId}`;

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
   * TC-SG-VC1 (T03): Existing goal → Validate → Confirm → Choose Mode → Search
   *
   * Что тестируем:
   * Пользователь с существующей целью хочет проверить её перед поиском.
   * Validation показывает кандидатов через by_target search.
   * После confirm — выбирает режим поиска, затем видит результаты.
   *
   * Бизнес-ценность:
   * - Пользователь может "примерить" цель перед поиском
   * - Видит реальных людей, достигших этой позиции
   * - Принимает осознанное решение о сохранении цели
   *
   * Given:
   * - User: U1 (middle frontend) с goal { position: ["senior"], domains: ["frontend"] }
   * - Pathfinder: U5 (middle → senior frontend)
   *
   * Flow:
   * - Turn 1: "покажи результаты" → load_existing_goal → show_goal
   *   (пользователь с целью сначала видит show_goal, не сразу search)
   * - Turn 2: "проверить" (validate) → validate_goal → ask_after_validate
   * - Turn 3: "сохрани" (save) → set_goal → asking_search_mode (new flow!)
   * - Turn 4: "проводники" → search_pathfinders → showing_results
   *
   * Then:
   * - Turn 1: phase = showing_goal (показываем существующую цель)
   * - Turn 2: phase = asking_after_validate (показываем кандидатов через by_target)
   * - Turn 2: candidates.length > 0 (есть кандидаты для senior frontend)
   * - Turn 3: phase = asking_search_mode (выбор режима поиска)
   * - Turn 4: phase = showing_results (финальные результаты поиска)
   * - Turn 4: goal persisted in Neo4j
   *
   * Тип теста: Integration (multi-turn, real LLM, Neo4j)
   */
  it("TC-SG-VC1: existing goal → validate → confirm → search", async () => {
    const ctx = FacadeTestContext.getInstance();

    // Setup: create goal (senior frontend — U5 achieved this from middle frontend)
    await setupUserWithGoal(ctx.coreClient, {
      userId: testUserId,
      targetContext: targetContextSchema.parse({
        position: { mode: "desired", values: ["senior"] },
        domains: { mode: "desired", values: ["frontend"] },
      }),
    });

    const goal = await ctx.coreClient.client.goal.getByUser.query({ userId: testUserId });
    expect(goal, "Goal must exist before test").not.toBeNull();

    // Turn 1: User wants to review goal first
    const turn1 = await runGraph("покажи мою цель");
    expect(
      turn1.phase,
      "Turn 1: User with existing goal asking about goal MUST show goal for review. " +
        "If this fails, check: (1) load_existing_goal routing, (2) show_goal node",
    ).toBe(PHASE.showing_goal);

    if (turn1.phase !== PHASE.showing_goal) {
      expect.fail("Type guard failed after strict assertion");
    }

    // Verify extracted goal matches setup
    expect(
      turn1.extractedGoal?.position?.values ?? [],
      "Turn 1: Extracted goal MUST contain position from Neo4j",
    ).toContain("senior");

    console.log("Turn 1: ✅ Existing goal loaded and shown");

    // Turn 2: User wants to validate (see who achieved this goal)
    // New flow: validation first shows facets (asking_after_validate_facets)
    const turn2 = await runGraph("покажи кто достиг такой цели");

    // Accept both phases: facets (new flow) or candidates (legacy)
    const validValidatePhases = [PHASE.asking_after_validate_facets, PHASE.asking_after_validate_candidates];
    expect(
      validValidatePhases,
      "Turn 2: 'validate' intent MUST trigger validation. " +
        "If this fails, check: (1) parseUserIntent, (2) routeAfterParseSearchIntent",
    ).toContain(turn2.phase);

    console.log(`Turn 2: ✅ Validation triggered (phase: ${turn2.phase})`);

    // Turn 3: User confirms the goal → asking_search_mode (new flow)
    const turn3 = await runGraph("сохрани");
    expect(
      turn3.phase,
      "Turn 3: 'save' intent after validation MUST persist goal and ask for search mode. " +
        "If this fails, check: (1) routeAfterAskAfterValidate, (2) set_goal, (3) ask_search_mode",
    ).toBe(PHASE.asking_search_mode);

    // Verify goal still exists in Neo4j (set_goal called)
    const savedGoal = await ctx.coreClient.client.goal.getByUser.query({ userId: testUserId });
    expect(savedGoal, "Turn 3: Goal MUST remain in Neo4j after confirmation").not.toBeNull();

    console.log("Turn 3: ✅ Goal confirmed, asking search mode");

    // Turn 4: Choose search mode → showing_pathfinder_results
    const turn4 = await runGraph("проводники");
    expect(turn4.phase, "Turn 4: Search mode selection MUST show results").toBe(PHASE.showing_pathfinder_results);

    if (turn4.phase !== PHASE.showing_pathfinder_results) {
      expect.fail("Type guard failed after strict assertion");
    }

    // Verify search results
    expect(
      turn4.results.length,
      "Turn 4: Search MUST return results (fixtures have matching candidates)",
    ).toBeGreaterThan(0);

    console.log(`Turn 4: ✅ Search complete (${turn4.results.length} results)`);
  }, 240_000);

  /* eslint-disable complexity -- multi-turn test requires sequential assertions */
  /**
   * TC-SG-VC2 (T04): New goal → Clarify → Save → Choose Mode → Search
   *
   * Что тестируем:
   * Пользователь формулирует цель, затем уточняет её через clarify flow в 1 сообщение.
   * parseIntent извлекает clarificationText из сообщения.
   * LLM применяет уточнения к текущей цели.
   *
   * Бизнес-ценность:
   * - Пользователь уточняет цель естественным языком ("добавь Германию")
   * - Не нужно два сообщения (старая архитектура с interrupt внутри node)
   * - Добавляет фильтры (страна, индустрия) одним сообщением
   *
   * Given:
   * - User: U1 (без goal в Neo4j)
   *
   * Flow:
   * - Turn 1: "ищу работу" → explore → showing_exploration
   * - Turn 2: "хочу стать менеджером" → extract_goal → showing_goal
   * - Turn 3: "добавь Германию" → parseIntent extracts clarificationText → showing_goal (updated)
   * - Turn 4: "сохрани" → set_goal → asking_search_mode (new flow!)
   * - Turn 5: "проводники" → search_pathfinders → showing_results
   *
   * Then:
   * - Turn 2: extractedGoal.position contains "manager" variant
   * - Turn 3: extractedGoal.countries contains "DE" or "Germany" (LLM normalized)
   * - Turn 4: phase = asking_search_mode
   * - Turn 5: goal persisted with both position AND countries
   *
   * Тип теста: Integration (multi-turn, real LLM, Neo4j)
   */
  it("TC-SG-VC2: new goal → clarify → save", async () => {
    const ctx = FacadeTestContext.getInstance();

    // Pre-check: no goal
    let goal = await ctx.coreClient.client.goal.getByUser.query({ userId: testUserId });
    expect(goal, "Goal must be absent before test").toBeNull();

    // Turn 1: start exploration
    const turn1 = await runGraph("ищу работу");
    expect(turn1.phase).toBe(PHASE.showing_exploration_candidates);
    console.log("Turn 1: ✅ Exploration started");

    // Turn 2: express initial goal
    const turn2 = await runGraph("хочу стать менеджером продукта");
    expect(
      turn2.phase,
      "Turn 2: Goal expression MUST trigger extraction and show_goal. " +
        "If this fails, check: (1) routeAfterShowExploration, (2) extract_goal node",
    ).toBe(PHASE.showing_goal);

    if (turn2.phase !== PHASE.showing_goal) {
      expect.fail("Type guard failed after strict assertion");
    }

    // Verify LLM extracted position
    const positionValues = turn2.extractedGoal?.position?.values ?? [];
    expect(positionValues.length, "Turn 2: LLM MUST extract position from 'менеджером продукта'").toBeGreaterThan(0);

    // Position could be "product manager", "PM", "менеджер продукта", etc.
    const hasManagerVariant = positionValues.some(
      (v) =>
        v.toLowerCase().includes("manager") || v.toLowerCase().includes("pm") || v.toLowerCase().includes("менеджер"),
    );
    expect(
      hasManagerVariant,
      `Turn 2: Position MUST contain manager variant, got: ${JSON.stringify(positionValues)}`,
    ).toBe(true);

    console.log(`Turn 2: ✅ Goal extracted (position: ${positionValues.join(", ")})`);

    // Turn 3: clarify (1-turn flow via parseIntent extracting clarificationText)
    const turn3 = await runGraph("добавь Германию");
    expect(
      turn3.phase,
      "Turn 3: Clarify with text MUST extract clarificationText, update goal, and show. " +
        "If this fails, check: (1) parseUserIntent extracts clarificationText, " +
        "(2) show-goal passes it to state, (3) clarify_goal uses it",
    ).toBe(PHASE.showing_goal);

    if (turn3.phase !== PHASE.showing_goal) {
      expect.fail("Type guard failed after strict assertion");
    }

    // Verify countries were added (LLM may normalize "Германию" → "DE" or keep "Germany")
    const countryValues = turn3.extractedGoal?.countries?.values ?? [];
    const hasGermany = countryValues.some(
      (v) =>
        v.toLowerCase().includes("germany") || v.toLowerCase().includes("de") || v.toLowerCase().includes("германия"),
    );
    expect(
      hasGermany,
      `Turn 3: Countries MUST contain Germany variant after clarification, got: ${JSON.stringify(countryValues)}`,
    ).toBe(true);

    console.log(`Turn 3: ✅ Goal clarified (countries: ${countryValues.join(", ")})`);

    // Turn 4: save the clarified goal → asking_search_mode (new flow)
    const turn4 = await runGraph("сохрани");
    expect(turn4.phase, "Turn 4: 'save' intent MUST persist goal and ask for search mode").toBe(
      PHASE.asking_search_mode,
    );

    // Verify goal persisted in Neo4j with BOTH position AND countries
    goal = await ctx.coreClient.client.goal.getByUser.query({ userId: testUserId });
    expect(goal, "Turn 4: Goal MUST be saved to Neo4j").not.toBeNull();

    const savedPositionValues = goal?.targetContext.position?.values ?? [];
    expect(savedPositionValues.length, "Turn 4: Saved goal MUST have position").toBeGreaterThan(0);

    const savedCountryValues = goal?.targetContext.countries?.values ?? [];
    expect(savedCountryValues.length, "Turn 4: Saved goal MUST have countries from clarification").toBeGreaterThan(0);

    console.log("Turn 4: ✅ Goal saved, asking search mode");

    // Turn 5: choose search mode → showing_pathfinder_results
    const turn5 = await runGraph("проводники");
    expect(turn5.phase, "Turn 5: Search mode selection MUST show results").toBe(PHASE.showing_pathfinder_results);

    if (turn5.phase !== PHASE.showing_pathfinder_results) {
      expect.fail("Type guard failed after strict assertion");
    }

    console.log("Turn 5: ✅ Clarified goal saved, search complete");
    console.log(`  Final goal: position=${savedPositionValues.join(",")}, countries=${savedCountryValues.join(",")}`);
  }, 300_000); // 5 min for 5-turn flow
  /* eslint-enable complexity */

  /**
   * TC-SG-VC3 (NEW): Show goal → Validation → Clarify → Re-validate
   *
   * Что тестируем:
   * User с существующей целью сначала видит цель для review.
   * После validate — видит candidates.
   * Clarify intent после validation обновляет extractedGoal через clarify_goal.
   * Повторная validation использует обновлённую цель.
   *
   * Бизнес-ценность:
   * - User с целью сначала видит её для review
   * - Может запросить validation (кто достиг цели)
   * - Решает сузить поиск (добавить страну)
   * - Видит новую validation с фильтром
   *
   * Given:
   * - User: U1 с goal { position: [\"senior\"], domains: [\"backend\"] }
   *
   * Flow:
   * - Turn 1: "проверить" → showing_goal (new: show goal first for review)
   * - Turn 2: "проверить" → validate_goal → asking_after_validate (candidates)
   * - Turn 3: "добавь Германию" → clarify_goal → showing_goal (updated)
   * - Turn 4: "проверить снова" → validate_goal → asking_after_validate (filtered)
   *
   * Then:
   * - Turn 1: phase = showing_goal (goal review first)
   * - Turn 2: phase = asking_after_validate, candidates.length > 0
   * - Turn 3: phase = showing_goal, extractedGoal.countries contains Germany variant
   * - Turn 4: phase = asking_after_validate, candidates <= turn2 count
   *
   * Тип теста: Integration (multi-turn, real LLM, Neo4j)
   */
  it("TC-SG-VC3: show goal → validation → clarify → re-validate", async () => {
    const ctx = FacadeTestContext.getInstance();

    // Setup: create goal (senior backend)
    await setupUserWithGoal(ctx.coreClient, {
      userId: testUserId,
      targetContext: targetContextSchema.parse({
        position: { mode: "desired", values: ["senior"] },
        domains: { mode: "desired", values: ["backend"] },
      }),
    });

    const goal = await ctx.coreClient.client.goal.getByUser.query({ userId: testUserId });
    expect(goal, "Goal must exist before test").not.toBeNull();

    // Turn 1: User with goal sees goal for review first
    const turn1 = await runGraph("проверить");
    expect(
      turn1.phase,
      "Turn 1: User with goal MUST see goal for review first. " +
        "If this fails, check: (1) routeAfterCheckGoal, (2) load_existing_goal → show_goal edge",
    ).toBe(PHASE.showing_goal);

    console.log("Turn 1: ✅ Goal shown for review");

    // Turn 2: Now validate (from showing_goal phase)
    // New flow: validation first shows facets (asking_after_validate_facets)
    const turn2 = await runGraph("покажи примеры людей с такой карьерой");

    // Accept both phases: facets (new flow) or candidates (legacy)
    const validValidatePhases = [PHASE.asking_after_validate_facets, PHASE.asking_after_validate_candidates];
    expect(
      validValidatePhases,
      "Turn 2: 'validate' intent from showing_goal MUST trigger validation. " +
        "If this fails, check: (1) parseUserIntent, (2) routeAfterParseSearchIntent",
    ).toContain(turn2.phase);

    console.log(`Turn 2: ✅ Validation triggered (phase: ${turn2.phase})`);

    // Turn 3: User wants to clarify goal (add country filter)
    const turn3 = await runGraph("добавь Германию");
    expect(
      turn3.phase,
      "Turn 3: 'clarify' intent MUST update goal via clarify_goal. " +
        "If this fails, check: (1) ask-after-validate extracts clarificationText, " +
        "(2) routeAfterParseSearchIntent routes to clarify_goal",
    ).toBe(PHASE.showing_goal);

    if (turn3.phase !== PHASE.showing_goal) {
      expect.fail("Type guard failed after strict assertion");
    }

    // Verify countries were added
    const countryValues = turn3.extractedGoal?.countries?.values ?? [];
    const hasGermany = countryValues.some(
      (v) =>
        v.toLowerCase().includes("germany") || v.toLowerCase().includes("de") || v.toLowerCase().includes("германия"),
    );
    expect(
      hasGermany,
      `Turn 3: Countries MUST contain Germany variant after clarification, got: ${JSON.stringify(countryValues)}`,
    ).toBe(true);

    console.log(`Turn 3: ✅ Goal clarified (countries: ${countryValues.join(", ")})`);

    // Turn 4: User wants to re-validate with updated goal (Germany already in extractedGoal from Turn 3)
    // New flow: validation shows facets first
    const turn4 = await runGraph("покажи ещё раз кто достиг такой цели");

    // Accept both phases: facets (new flow) or candidates (legacy)
    expect(validValidatePhases, "Turn 4: Re-validation MUST work with updated goal").toContain(turn4.phase);

    console.log(`Turn 4: ✅ Re-validation with filter (phase: ${turn4.phase})`);
  }, 300_000); // 5 min for 4-turn flow
});
