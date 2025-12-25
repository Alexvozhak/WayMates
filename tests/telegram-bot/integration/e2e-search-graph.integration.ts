import { randomUUID } from "node:crypto";

import { describe, expect, it, beforeAll, afterEach } from "vitest";

import { TelegramTestContext } from "../helpers/test-context.js";

import type { SessionId, UserId } from "../../../src/shared/schemas.js";

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
  // Use U3 from fixtures (junior→middle backend) — has contexts for adhoc search
  const testUserId: UserId = "usr_019a6ea7-18bf-744a-afe5-1021f89d019b";

  beforeAll(async () => {
    const ctx = TelegramTestContext.getInstance();

    // Create session for fixture user via TelegramTestContext
    testSessionId = await ctx.createSessionForUser(testUserId);

    console.log(`[E2E Setup] Created session for fixture user U3: ${testUserId}`);

    // Cancel any active graph from previous test runs
    try {
      await ctx.mcpClient.callTool("converse", {
        message: "отмена",
        sessionId: testSessionId,
        requestId: randomUUID(),
      });
      console.log(`[E2E Setup] Cancelled active graph (if any)`);
    } catch {
      console.log(`[E2E Setup] No active graph to cancel (fresh start)`);
    }

    console.log(`[E2E Setup] Test session ready: ${testSessionId}`);
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
      requestId: randomUUID(),
    });

    console.log(`[E2E Turn 1] Response phase: ${turn1.result.phase}`);
    expect(turn1.result.phase, "Turn 1: startAdhoc intent MUST trigger confirming phase").toBe(
      "confirming_adhoc_context",
    );

    if (turn1.result.phase !== "confirming_adhoc_context") {
      expect.fail("Type guard failed after strict assertion");
    }

    console.log(`[E2E Turn 1] Adhoc context confirmed, proceeding to exploration...`);
  }

  async function executeProceedToExplorationTurn(sessionId: SessionId) {
    const ctx = TelegramTestContext.getInstance();
    console.log("[E2E Turn 2] Proceeding to exploration...");

    const turn2 = await ctx.mcpClient.callTool("converse", {
      message: "давай посмотрим похожих",
      sessionId,
      requestId: randomUUID(),
    });

    console.log(`[E2E Turn 2] Response phase: ${turn2.result.phase}`);
    expect(turn2.result.phase, "Turn 2: proceed intent MUST trigger exploration phase").toMatch(/^showing_exploration/);

    if (!turn2.result.phase.startsWith("showing_exploration")) {
      expect.fail("Type guard failed after strict assertion");
    }

    console.log(`[E2E Turn 2] Exploration phase: ${turn2.result.phase}`);
  }

  async function executeApplyFiltersTurn(sessionId: SessionId) {
    const ctx = TelegramTestContext.getInstance();
    console.log("[E2E Turn 3] Applying relaxed filters...");

    const turn3 = await ctx.mcpClient.callTool("converse", {
      message: "Покажи без учёта города, страны, индустрии, возраста и языков",
      sessionId,
      requestId: randomUUID(),
    });

    console.log(`[E2E Turn 3] Response phase: ${turn3.result.phase}`);
    expect(turn3.result.phase, "Turn 3: filter intent MUST stay in exploration phase with updated params").toMatch(
      /^showing_exploration/,
    );

    if (!turn3.result.phase.startsWith("showing_exploration")) {
      expect.fail("Type guard failed after strict assertion");
    }

    console.log(`[E2E Turn 3] Exploration phase: ${turn3.result.phase} (relaxed filters)`);
  }

  async function executeExtractGoalTurn(sessionId: SessionId) {
    const ctx = TelegramTestContext.getInstance();
    console.log("[E2E Turn 4] Extracting goal...");

    const turn4 = await ctx.mcpClient.callTool("converse", {
      message: "Хочу стать middle backend разработчиком",
      sessionId,
      requestId: randomUUID(),
    });

    console.log(`[E2E Turn 4] Response phase: ${turn4.result.phase}`);
    expect(turn4.result.phase, "Turn 4: User expresses goal MUST trigger extraction and showing_goal phase").toBe(
      "showing_goal",
    );

    if (turn4.result.phase !== "showing_goal") {
      expect.fail("Type guard failed after strict assertion");
    }

    const positionValues = turn4.result.extractedGoal.position?.values ?? [];
    const domainValues = turn4.result.extractedGoal.domains?.values ?? [];

    console.log(`[E2E Turn 4] Extracted position: ${JSON.stringify(positionValues)}`);
    console.log(`[E2E Turn 4] Extracted domains: ${JSON.stringify(domainValues)}`);

    expect(
      positionValues.some((v) => v.toLowerCase().includes("middle")),
      `Turn 4: LLM MUST extract "middle" from message, got: ${JSON.stringify(positionValues)}`,
    ).toBe(true);

    expect(
      domainValues.some((v: string) => v.toLowerCase().includes("backend")),
      `Turn 4: LLM MUST extract "backend" from message, got: ${JSON.stringify(domainValues)}`,
    ).toBe(true);
  }

  async function executeSaveAndSearchTurn(sessionId: SessionId) {
    const ctx = TelegramTestContext.getInstance();
    console.log("[E2E Turn 5] Saving goal and searching...");

    const turn5 = await ctx.mcpClient.callTool("converse", {
      message: "сохрани",
      sessionId,
      requestId: randomUUID(),
    });

    console.log(`[E2E Turn 5] Response phase: ${turn5.result.phase}`);
    expect(turn5.result.phase, "Turn 5: save intent MUST persist goal and show search results").toBe("showing_results");

    if (turn5.result.phase !== "showing_results") {
      expect.fail("Type guard failed after strict assertion");
    }

    console.log(`[E2E Turn 5] Results: ${turn5.result.results.length}`);
    expect(
      turn5.result.results.length,
      "Turn 5: With relaxed filters + middle backend goal, MUST return pathfinders (U3, U8, U10, U11)",
    ).toBeGreaterThanOrEqual(2);
    expect(
      turn5.result.results.length,
      "Turn 5: Results should not exceed expected pathfinders count",
    ).toBeLessThanOrEqual(5);

    // Verify goal persisted to Neo4j
    const savedGoal = await ctx.coreClient.client.goal.getByUser.query({ userId: testUserId });

    expect(savedGoal, "Turn 5: Goal MUST be saved to Neo4j after 'save' command").not.toBeNull();

    const savedPositionValues = savedGoal?.targetContext.position?.values ?? [];
    expect(
      savedPositionValues.some((v) => v.toLowerCase().includes("middle")),
      `Turn 5: Saved goal MUST contain "middle", got: ${JSON.stringify(savedPositionValues)}`,
    ).toBe(true);

    // Note: path is only returned for DTW-enabled searches (user with trajectory)
    // For adhoc search, path may be undefined - that's expected behavior
    console.log("[E2E Turn 5] Search completed with goal filter applied");
  }

  // ========== Test case ==========

  /**
   * E2E-SG-01: Full adhoc → confirm → explore → filters → goal → save flow
   *
   * Сценарий:
   * Пользователь без профиля делает quick search, подтверждает контекст, применяет фильтры,
   * формирует цель и получает результаты.
   *
   * Given:
   * - User без сохранённого контекста
   * - Fixtures: U3, U8, U10, U11 (junior/middle backend траектории)
   *
   * Flow:
   * 1. Turn 1: adhoc context "Быстрый поиск: я junior backend разработчик"
   *    → startAdhoc intent → confirming_adhoc_context (спросить что дальше)
   *
   * 2. Turn 2: proceed to exploration "давай посмотрим похожих"
   *    → proceed intent → explore → showing_exploration
   *
   * 3. Turn 3: apply relaxed filters "Покажи без учёта города, страны, индустрии, возраста и языков"
   *    → filter intent → apply_filters → explore
   *    → showing_exploration (with relaxed filters)
   *
   * 4. Turn 4: extract goal "Хочу стать middle backend разработчиком"
   *    → clarify intent → extract_goal → showing_goal
   *    → extractedGoal contains "middle" + "backend"
   *
   * 5. Turn 5: save + search "сохрани"
   *    → save intent → set_goal → search → showing_results
   *    → results.length >= 2 (pathfinders: U3, U8, U10, U11)
   *
   * Then:
   * - Goal saved to Neo4j
   * - Results contain pathfinders с middle backend в траектории
   *
   * Тип теста: E2E Integration (real MCP → Facade → SearchGraph → Neo4j)
   */
  it("E2E-SG-01: adhoc → confirm → explore → filters → goal → save returns pathfinders", async () => {
    await executeAdhocContextTurn(testSessionId);
    await executeProceedToExplorationTurn(testSessionId);
    await executeApplyFiltersTurn(testSessionId);
    await executeExtractGoalTurn(testSessionId);
    await executeSaveAndSearchTurn(testSessionId);

    console.log("E2E-SG-01: ✅ Full adhoc → confirm → explore → filters → goal → save flow completed successfully");
  }, 300_000); // 5 min timeout for full E2E flow with LLM calls
});
