import { beforeEach, describe, expect, it } from "vitest";

import { PHASE } from "../../../../../src/facade/langGraph/search-graph/search-graph.js";
import { FacadeTestContext } from "../../../helpers/test-context.js";
import { cleanupUserGoal, runSearchGraph, setupUserWithGoal } from "../helpers/search-graph-helpers.js";

import type { UserId } from "../../../../../src/shared/schemas.js";

describe("SearchGraph Flow Integration (TC-SG)", () => {
  const testUserId: UserId = "usr_01933ec5-0006-0000-0000-000000000006";
  const threadId = `search_graph_${testUserId}`;

  beforeEach(async () => {
    const ctx = FacadeTestContext.getInstance();
    await ctx.checkpointService.delete(threadId);
    await cleanupUserGoal(ctx.coreClient, testUserId);
  });

  /**
   * TC-SG1: New user explore → goal → search → refine (Happy Path)
   *
   * На вход: новый пользователь U6 без цели, запрос "хочу найти работу".
   * Проверяем: полный путь explore → goal formation → search → refine.
   * Ожидаем: все фазы пройдены, цель сохранена в Neo4j, результаты выданы дважды.
   *
   * Инварианты: I2, I3, I8
   *
   * Given:
   * - User: testUserId (U6, no goal)
   * - Message: "хочу найти работу"
   *
   * Then:
   * - Phase transitions: exploring → showing_exploration → showing_goal → showing_results → showing_results (refine)
   * - Goal saved in Neo4j after validate → save
   * - Results returned twice (initial + refine)
   *
   * Тип теста: Integration (real LLM)
   */
  it("TC-SG1: new user explore → goal → search → refine", async () => {
    const ctx = FacadeTestContext.getInstance();

    const r1 = await runSearchGraph("хочу найти работу", threadId, testUserId);
    expect(r1.phase, "New user MUST start with explore").toBe(PHASE.showingExploration);

    const r2 = await runSearchGraph("proceed", threadId, testUserId);
    expect(r2.phase, "After explore MUST show goal").toBe(PHASE.showingGoal);

    const r3 = await runSearchGraph("validate", threadId, testUserId);
    expect(r3.phase, "After validate MUST ask for confirmation").toBe(PHASE.askingAfterValidate);

    const r4 = await runSearchGraph("save", threadId, testUserId);
    expect(
      r4.phase,
      "After save MUST show search results. " +
        "If this fails, check: (1) set_goal saves to Neo4j, (2) routing to search",
    ).toBe(PHASE.showingResults);

    if (r4.phase !== PHASE.showingResults) {
      expect.fail("Type guard failed after strict assertion");
    }

    expect(r4.results.length, "Initial search MUST return results").toBeGreaterThan(0);

    const goal1 = await ctx.coreClient.client.goal.getByUser.query({ userId: testUserId });
    expect(goal1, "Goal MUST be saved in Neo4j after save").not.toBeNull();

    const r5 = await runSearchGraph("refine", threadId, testUserId);
    expect(
      r5.phase,
      "Refine MUST reload goal and show results again. " +
        "If this fails, check: (1) routing from show_results, (2) load_existing_goal",
    ).toBe(PHASE.showingResults);

    if (r5.phase !== PHASE.showingResults) {
      expect.fail("Type guard failed after strict assertion");
    }

    expect(r5.results.length, "Refined search MUST return results").toBeGreaterThan(0);

    const goal2 = await ctx.coreClient.client.goal.getByUser.query({ userId: testUserId });
    expect(goal2?.userId, "Goal MUST persist after refine").toBe(testUserId);

    console.log(
      `TC-SG1: ✅ Happy path complete: explore → goal → search (${r4.results.length} results) → refine (${r5.results.length} results)`,
    );

    await cleanupUserGoal(ctx.coreClient, testUserId);
  }, 300_000);

  /**
   * TC-SG2: Existing user with goal → search directly
   *
   * На вход: пользователь U6 с готовой целью "Backend Developer" в Neo4j.
   * Проверяем: граф пропускает explore и загружает существующую цель.
   * Ожидаем: переход load_existing_goal → validate → search → showing_results.
   *
   * Инварианты: I1, I3
   *
   * Given:
   * - User: testUserId (U6)
   * - Goal: созданная через helper с targetContext.position = "Backend Developer"
   *
   * Then:
   * - Phase: showing_results (NO exploring phase)
   * - Results returned with at least 1 candidate
   *
   * Тип теста: Integration (real LLM)
   */
  it("TC-SG2: existing user with goal → search directly", async () => {
    const ctx = FacadeTestContext.getInstance();

    await setupUserWithGoal(ctx.coreClient, {
      userId: testUserId,
      targetContext: {
        position: {
          mode: "desired",
          values: ["Backend Developer"],
        },
      },
    });

    try {
      const response = await runSearchGraph("покажи результаты", threadId, testUserId);

      expect(
        response.phase,
        "User with existing goal MUST skip explore and go straight to search results. " +
          "If this fails, check: (1) check_goal routing logic, (2) goal load from Neo4j",
      ).toBe(PHASE.showingResults);

      if (response.phase !== PHASE.showingResults) {
        expect.fail("Type guard failed after strict assertion");
      }

      expect(response.results.length, "Search must return at least 1 result").toBeGreaterThan(0);

      console.log(`TC-SG2: ✅ User with goal skipped explore, got ${response.results.length} result(s)`);
    } finally {
      await cleanupUserGoal(ctx.coreClient, testUserId);
    }
  }, 120_000);

  /**
   * TC-SG6: Cancel from show_goal
   *
   * На вход: новый пользователь без цели, explore → proceed → show_goal → cancel.
   * Проверяем: пользователь может отменить процесс на любом interrupt.
   * Ожидаем: phase = cancelled, NO goal сохранена в Neo4j.
   *
   * Инварианты: I7
   *
   * Given:
   * - User: testUserId (no goal)
   * - Flow: explore → show_exploration → "proceed" → show_goal → "cancel"
   *
   * Then:
   * - Phase: cancelled
   * - Goal NOT saved in Neo4j
   *
   * Тип теста: Integration (real LLM)
   */
  it("TC-SG6: cancel from show_goal", async () => {
    const ctx = FacadeTestContext.getInstance();

    const response1 = await runSearchGraph("хочу найти работу", threadId, testUserId);

    expect(response1.phase, "New user MUST start with explore").toBe(PHASE.showingExploration);

    const response2 = await runSearchGraph("proceed", threadId, testUserId);

    expect(response2.phase, "After proceed MUST show goal").toBe(PHASE.showingGoal);

    const response3 = await runSearchGraph("cancel", threadId, testUserId);

    expect(
      response3.phase,
      "User MUST be able to cancel from any interrupt. " +
        "If this fails, check: (1) parseUserIntent cancel detection, (2) routing from show_goal",
    ).toBe(PHASE.cancelled);

    const goal = await ctx.coreClient.client.goal.getByUser.query({ userId: testUserId });
    expect(goal, "Goal MUST NOT be saved after cancel").toBeNull();

    console.log("TC-SG6: ✅ User cancelled from show_goal, no goal saved");
  }, 180_000);

  /**
   * TC-SG5: Delete goal → explore
   *
   * На вход: пользователь с существующей целью, search results → delete.
   * Проверяем: удаление цели возвращает пользователя к изучению.
   * Ожидаем: goal удалена из Neo4j, phase = showing_exploration.
   *
   * Инварианты: I4
   *
   * Given:
   * - User: testUserId with existing goal "Data Scientist"
   * - Flow: showing_results → "delete"
   *
   * Then:
   * - Goal deleted from Neo4j
   * - Phase: showing_exploration (back to explore)
   *
   * Тип теста: Integration (real LLM)
   */
  it("TC-SG5: delete goal → explore", async () => {
    const ctx = FacadeTestContext.getInstance();

    await setupUserWithGoal(ctx.coreClient, {
      userId: testUserId,
      targetContext: {
        position: {
          mode: "desired",
          values: ["Data Scientist"],
        },
      },
    });

    try {
      const r1 = await runSearchGraph("покажи результаты", threadId, testUserId);
      expect(r1.phase, "User with goal MUST show results").toBe(PHASE.showingResults);

      const r2 = await runSearchGraph("delete", threadId, testUserId);
      expect(
        r2.phase,
        "After delete MUST return to explore. " +
          "If this fails, check: (1) delete_goal removes from Neo4j, (2) routing to explore",
      ).toBe(PHASE.showingExploration);

      const goal = await ctx.coreClient.client.goal.getByUser.query({ userId: testUserId });
      expect(goal, "Goal MUST be deleted from Neo4j").toBeNull();

      console.log("TC-SG5: ✅ Goal deleted, user returned to explore");
    } finally {
      await cleanupUserGoal(ctx.coreClient, testUserId);
    }
  }, 180_000);

  /**
   * TC-SG3: Clarify rounds limit (3 max)
   *
   * На вход: новый пользователь, explore → goal → clarify (3 раза).
   * Проверяем: защита от бесконечных уточнений (максимум 3 раза).
   * Ожидаем: после 3-го clarify автоматическое сохранение цели.
   *
   * Инварианты: I5
   *
   * Given:
   * - User: testUserId (no goal)
   * - Flow: explore → show_goal → "clarify" x3
   *
   * Then:
   * - After 3rd clarify → автоматическое сохранение
   * - Phase: showing_results (skips manual save)
   * - Goal saved in Neo4j
   *
   * Тип теста: Integration (real LLM)
   */
  it("TC-SG3: clarify rounds limit (3 max)", async () => {
    const ctx = FacadeTestContext.getInstance();

    const r1 = await runSearchGraph("хочу найти работу", threadId, testUserId);
    expect(r1.phase).toBe(PHASE.showingExploration);

    const r2 = await runSearchGraph("proceed", threadId, testUserId);
    expect(r2.phase).toBe(PHASE.showingGoal);

    const r3 = await runSearchGraph("clarify", threadId, testUserId);
    expect(r3.phase, "After 1st clarify MUST show goal again").toBe(PHASE.showingGoal);

    const r4 = await runSearchGraph("clarify", threadId, testUserId);
    expect(r4.phase, "After 2nd clarify MUST show goal again").toBe(PHASE.showingGoal);

    const r5 = await runSearchGraph("clarify", threadId, testUserId);
    expect(
      r5.phase,
      "After 3rd clarify MUST auto-save and show results. " +
        "If this fails, check: (1) clarifyRounds counter, (2) check_goal rounds limit logic",
    ).toBe(PHASE.showingResults);

    const goal = await ctx.coreClient.client.goal.getByUser.query({ userId: testUserId });
    expect(goal, "Goal MUST be auto-saved after 3 clarifications").not.toBeNull();

    console.log("TC-SG3: ✅ Clarify rounds limit enforced (3 max), auto-save triggered");

    await cleanupUserGoal(ctx.coreClient, testUserId);
  }, 300_000);

  /**
   * TC-SG4: Change rounds limit (3 max) in ask_after_validate
   *
   * На вход: explore → goal → validate → change (3 раза).
   * Проверяем: защита от бесконечных правок после валидации (максимум 3 раза).
   * Ожидаем: после 3-го change автоматическое сохранение цели.
   *
   * Инварианты: I6
   *
   * Given:
   * - User: testUserId (no goal)
   * - Flow: explore → show_goal → validate → "change" x3
   *
   * Then:
   * - After 3rd change → автоматическое сохранение
   * - Phase: showing_results (skips manual save)
   * - Goal saved in Neo4j
   *
   * Тип теста: Integration (real LLM)
   */
  it("TC-SG4: change rounds limit (3 max) in ask_after_validate", async () => {
    const ctx = FacadeTestContext.getInstance();

    const r1 = await runSearchGraph("хочу найти работу", threadId, testUserId);
    expect(r1.phase).toBe(PHASE.showingExploration);

    const r2 = await runSearchGraph("proceed", threadId, testUserId);
    expect(r2.phase).toBe(PHASE.showingGoal);

    const r3 = await runSearchGraph("validate", threadId, testUserId);
    expect(r3.phase).toBe(PHASE.askingAfterValidate);

    const r4 = await runSearchGraph("change", threadId, testUserId);
    expect(r4.phase, "After 1st change MUST show goal again").toBe(PHASE.showingGoal);

    const r5 = await runSearchGraph("validate", threadId, testUserId);
    expect(r5.phase).toBe(PHASE.askingAfterValidate);

    const r6 = await runSearchGraph("change", threadId, testUserId);
    expect(r6.phase, "After 2nd change MUST show goal again").toBe(PHASE.showingGoal);

    const r7 = await runSearchGraph("validate", threadId, testUserId);
    expect(r7.phase).toBe(PHASE.askingAfterValidate);

    const r8 = await runSearchGraph("change", threadId, testUserId);
    expect(
      r8.phase,
      "After 3rd change MUST auto-save and show results. " +
        "If this fails, check: (1) changeRounds counter, (2) check_goal rounds limit logic",
    ).toBe(PHASE.showingResults);

    const goal = await ctx.coreClient.client.goal.getByUser.query({ userId: testUserId });
    expect(goal, "Goal MUST be auto-saved after 3 changes").not.toBeNull();

    console.log("TC-SG4: ✅ Change rounds limit enforced (3 max), auto-save triggered");

    await cleanupUserGoal(ctx.coreClient, testUserId);
  }, 400_000);
});
