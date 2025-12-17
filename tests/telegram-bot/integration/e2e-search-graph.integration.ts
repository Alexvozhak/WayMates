import { describe, expect, it, beforeAll, afterEach } from "vitest";

import { TelegramTestContext } from "../helpers/test-context.js";

import type { SessionId } from "../../../src/shared/schemas.js";

/**
 * E2E тест SearchGraph через Telegram Bot MCP.
 *
 * Архитектура:
 * Telegram Bot (test) → MCP Client → MCP Server Facade → Orchestrator → SearchGraph
 *
 * Сценарий:
 * Пользователь приходит без профиля, делает adhoc search с фильтрами,
 * формирует цель и получает персонализированные результаты.
 *
 * Бизнес-ценность:
 * Проверяет ПОЛНЫЙ E2E flow через весь стек:
 * - MCP Server converse.tool
 * - Orchestrator intent classification (startAdhoc)
 * - SearchGraph adhoc extraction
 * - apply_filters normalization
 * - Goal formation + persistence
 * - Search с pathfinders
 */
describe("E2E: SearchGraph via Telegram Bot MCP", () => {
  let testSessionId: SessionId;
  let testUserId: UserId;  // Real userId from registration (UUIDv7)
  const TEST_TELEGRAM_USER_ID = 999999;

  beforeAll(async () => {
    const ctx = TelegramTestContext.getInstance();

    // Register test user FIRST to get real userId
    const registerResult = await ctx.mcpClient.callTool("register_telegram", {
      telegramUserId: TEST_TELEGRAM_USER_ID,
    });
    testSessionId = registerResult.sessionId;
    testUserId = registerResult.userId;  // Store for cleanup

    console.log(`[E2E Setup] Registered user: ${testUserId}`);

    // CRITICAL: Cancel any active graph from previous test runs
    // Use MCP converse tool instead of direct checkpoint cleanup
    // (test's CheckpointService and facade-test's CheckpointService use different PostgreSQL databases)
    try {
      await ctx.mcpClient.callTool("converse", {
        message: "отмена",
        sessionId: testSessionId,
      });
      console.log(`[E2E Setup] Cancelled active graph (if any)`);
    } catch (error) {
      console.log(`[E2E Setup] No active graph to cancel (fresh start)`);
    }

    console.log(`[E2E Setup] Test user registered with sessionId: ${testSessionId}`);
  });

  afterEach(async () => {
    // Clean up goal after each test
    const ctx = TelegramTestContext.getInstance();

    // TODO: Add checkpoint cleanup via Facade MCP tool (when available)
    // For now checkpoints are isolated by userId, so not critical

    // Clean up goal using real userId from registration
    try {
      await ctx.coreClient.client.goal.delete.mutate({ userId: testUserId });
      console.log(`[E2E Cleanup] Goal deleted for user ${testUserId}`);
    } catch {
      // Goal might not exist, ignore error
    }
  });

  // ========== Helper functions to reduce complexity ==========

  async function executeAdhocContextTurn(sessionId: SessionId) {
    const ctx = TelegramTestContext.getInstance();
    console.log("[E2E Turn 1] Sending adhoc context...");

    const turn1 = await ctx.mcpClient.callTool("converse", {
      message: "Быстрый поиск: я junior backend разработчик",
      sessionId,
    });

    console.log(`[E2E Turn 1] Response phase: ${turn1.result.phase}`);
    expect(turn1.result.phase, "Turn 1: startAdhoc intent MUST trigger exploration phase").toBe(
      "showing_exploration",
    );

    if (turn1.result.phase !== "showing_exploration") {
      expect.fail("Type guard failed after strict assertion");
    }

    console.log(`[E2E Turn 1] Candidates: ${turn1.result.candidates.length} (strict filters OK)`);
    expect(
      turn1.result.candidates.length,
      "Turn 1: With strict filters, 0 candidates is expected (different geo/industry across fixtures)",
    ).toBe(0);
  }

  async function executeApplyFiltersTurn(sessionId: SessionId) {
    const ctx = TelegramTestContext.getInstance();
    console.log("[E2E Turn 2] Applying relaxed filters...");

    const turn2 = await ctx.mcpClient.callTool("converse", {
      message: "Покажи без учёта города, страны, индустрии, возраста и языков",
      sessionId,
    });

    console.log(`[E2E Turn 2] Response phase: ${turn2.result.phase}`);
    expect(turn2.result.phase, "Turn 2: filter intent MUST stay in exploration phase with updated params").toBe(
      "showing_exploration",
    );

    if (turn2.result.phase !== "showing_exploration") {
      expect.fail("Type guard failed after strict assertion");
    }

    console.log(`[E2E Turn 2] Candidates: ${turn2.result.candidates.length} (relaxed filters)`);
    expect(
      turn2.result.candidates.length,
      "Turn 2: With relaxed filters (excludes geo/industry), MUST return candidates matching junior backend",
    ).toBeGreaterThanOrEqual(2);

    expect(turn2.result.appliedCurrentFilters, "Turn 2: appliedCurrentFilters MUST be present after filter intent").toBeDefined();

    const excludedFields = turn2.result.appliedCurrentFilters?.excludedContextFields ?? [];
    console.log(`[E2E Turn 2] Excluded fields: ${excludedFields.join(", ")}`);
    expect(excludedFields.length, "Turn 2: LLM MUST extract excluded fields from filter message").toBeGreaterThan(0);
  }

  async function executeExtractGoalTurn(sessionId: SessionId) {
    const ctx = TelegramTestContext.getInstance();
    console.log("[E2E Turn 3] Extracting goal...");

    const turn3 = await ctx.mcpClient.callTool("converse", {
      message: "Хочу стать middle backend разработчиком",
      sessionId,
    });

    console.log(`[E2E Turn 3] Response phase: ${turn3.result.phase}`);
    expect(turn3.result.phase, "Turn 3: User expresses goal MUST trigger extraction and showing_goal phase").toBe(
      "showing_goal",
    );

    if (turn3.result.phase !== "showing_goal") {
      expect.fail("Type guard failed after strict assertion");
    }

    const positionValues = turn3.result.extractedGoal.position?.values ?? [];
    const domainValues = turn3.result.extractedGoal.domains?.values ?? [];

    console.log(`[E2E Turn 3] Extracted position: ${JSON.stringify(positionValues)}`);
    console.log(`[E2E Turn 3] Extracted domains: ${JSON.stringify(domainValues)}`);

    expect(
      positionValues.some((v) => v.toLowerCase().includes("middle")),
      `Turn 3: LLM MUST extract "middle" from message, got: ${JSON.stringify(positionValues)}`,
    ).toBe(true);

    expect(
      domainValues.some((v: string) => v.toLowerCase().includes("backend")),
      `Turn 3: LLM MUST extract "backend" from message, got: ${JSON.stringify(domainValues)}`,
    ).toBe(true);
  }

  async function executeSaveAndSearchTurn(sessionId: SessionId) {
    const ctx = TelegramTestContext.getInstance();
    console.log("[E2E Turn 4] Saving goal and searching...");

    const turn4 = await ctx.mcpClient.callTool("converse", {
      message: "сохрани",
      sessionId,
    });

    console.log(`[E2E Turn 4] Response phase: ${turn4.result.phase}`);
    expect(turn4.result.phase, "Turn 4: save intent MUST persist goal and show search results").toBe(
      "showing_results",
    );

    if (turn4.result.phase !== "showing_results") {
      expect.fail("Type guard failed after strict assertion");
    }

    console.log(`[E2E Turn 4] Results: ${turn4.result.results.length}`);
    expect(
      turn4.result.results.length,
      "Turn 4: With relaxed filters + middle backend goal, MUST return pathfinders (U3, U8, U10, U11)",
    ).toBeGreaterThanOrEqual(2);
    expect(turn4.result.results.length, "Turn 4: Results should not exceed expected pathfinders count").toBeLessThanOrEqual(
      5,
    );

    // Verify goal persisted to Neo4j
    const savedGoal = await ctx.coreClient.client.goal.getByUser.query({ userId: testUserId });

    expect(savedGoal, "Turn 4: Goal MUST be saved to Neo4j after 'save' command").not.toBeNull();

    const savedPositionValues = savedGoal?.targetCriteria.position?.values ?? [];
    expect(
      savedPositionValues.some((v) => v.toLowerCase().includes("middle")),
      `Turn 4: Saved goal MUST contain "middle", got: ${JSON.stringify(savedPositionValues)}`,
    ).toBe(true);

    // Verify results are pathfinders
    console.log("[E2E Turn 4] Verifying pathfinders have middle backend in trajectory...");
    for (const result of turn4.result.results) {
      const hasMiddleBackend =
        result.path?.some((ctxItem) => {
          const isMiddle = ctxItem.position.toLowerCase().includes("middle");
          const isBackend = ctxItem.domains.some((d: string) => d.toLowerCase().includes("backend"));
          return isMiddle && isBackend;
        }) ?? false;

      expect(hasMiddleBackend, `Candidate ${result.userId} MUST have middle backend in trajectory to be a pathfinder`).toBe(
        true,
      );
    }
  }

  // ========== Test case ==========

  /**
   * E2E-SG-01: Full adhoc → filters → goal → save flow
   *
   * Сценарий:
   * Пользователь без профиля делает quick search, применяет фильтры для broader matching,
   * формирует цель и получает результаты.
   *
   * Given:
   * - User без сохранённого контекста
   * - Fixtures: U3, U8, U10, U11 (junior/middle backend траектории)
   *
   * Flow:
   * 1. Turn 1: adhoc context "Быстрый поиск: я junior backend разработчик"
   *    → startAdhoc intent → explore → showing_exploration
   *    → candidates = [] (strict filters, ожидаемо)
   *
   * 2. Turn 2: apply relaxed filters "Покажи без учёта города, страны, индустрии, возраста и языков"
   *    → filter intent → apply_filters → explore
   *    → candidates.length >= 2 (U3, U8, U10, U11 видны с relaxed filters)
   *
   * 3. Turn 3: extract goal "Хочу стать middle backend разработчиком"
   *    → extract_goal → showing_goal
   *    → extractedGoal contains "middle" + "backend"
   *
   * 4. Turn 4: save + search "сохрани"
   *    → set_goal → search → showing_results
   *    → results.length >= 2 (pathfinders: U3, U8, U10, U11)
   *
   * Then:
   * - Goal saved to Neo4j
   * - Results contain pathfinders с middle backend в траектории
   *
   * Тип теста: E2E Integration (real MCP → Facade → SearchGraph → Neo4j)
   */
  it("E2E-SG-01: adhoc → filters → goal → save returns pathfinders", async () => {
    await executeAdhocContextTurn(testSessionId);
    await executeApplyFiltersTurn(testSessionId);
    await executeExtractGoalTurn(testSessionId);
    await executeSaveAndSearchTurn(testSessionId);

    console.log("E2E-SG-01: ✅ Full adhoc → filters → goal → save flow completed successfully");
  }, 300_000); // 5 min timeout for full E2E flow with LLM calls
});
