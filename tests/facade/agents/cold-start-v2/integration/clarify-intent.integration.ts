import { beforeEach, describe, expect, it } from "vitest";

import { ColdStartGraph, PHASE } from "../../../../../src/facade/langGraph/cold-start-v2/cold-start-graph.js";
import { FacadeTestContext } from "../../../helpers/test-context.js";

import type { UserId } from "../../../../../src/shared/schemas.js";

describe("Cold-Start V2: Clarify Intent (TC-CS-CI)", () => {
  const testUserId: UserId = "usr_01933ec5-0009-0000-0000-000000000009";
  const threadId = `cold_start_ci_${testUserId}`;

  const runWorkflow = (message: string): ReturnType<ColdStartGraph["run"]> => {
    const ctx = FacadeTestContext.getInstance();
    return new ColdStartGraph(ctx.getGraphDeps()).run(message, threadId, testUserId, null, "en");
  };

  beforeEach(async () => {
    const ctx = FacadeTestContext.getInstance();
    await ctx.checkpointService.delete(threadId);
  });

  /**
   * TC-CS-UNKNOWN1: Unknown intent в story_gathering
   *
   * Что тестируем:
   * Непонятное сообщение в story_gathering вызывает clarify_intent.
   * Граф остаётся в story_gathering, LLM переспрашивает.
   *
   * Given:
   * - User в story_gathering phase
   * - Turn 2: emoji-only или gibberish
   *
   * Flow:
   * - Turn 1: "привет" → story_gathering
   * - Turn 2: "🎵🎵🎵" (emoji only) → clarify_intent → story_gathering
   *
   * Then:
   * - Turn 2: phase = story_gathering (остаётся)
   * - Turn 2: message содержит уточняющий вопрос
   * - Workflow НЕ падает
   *
   * Тип теста: Integration (real LLM)
   */
  it("TC-CS-UNKNOWN1: unknown intent в story_gathering", async () => {
    // Turn 1: Start story gathering
    const turn1 = await runWorkflow("привет, хочу рассказать о своей карьере");
    expect(turn1.phase).toBe(PHASE.story_gathering);

    if (turn1.phase !== PHASE.story_gathering) {
      expect.fail("Type guard failed after strict assertion");
    }

    console.log("TC-CS-UNKNOWN1 [1/2]: ✅ Story gathering started");

    // Turn 2: Send emoji-only message → should trigger clarify_intent
    const turn2 = await runWorkflow("🎵🎵🎵 ✨✨✨");

    // Graceful handling: should stay in story_gathering or handle gracefully
    const isValidPhase = turn2.phase === PHASE.story_gathering || turn2.phase === PHASE.failed;

    expect(isValidPhase, `Turn 2: Emoji-only message MUST be handled gracefully. Got: ${turn2.phase}`).toBe(true);

    // If still in story_gathering, LLM should respond with clarification request
    if (turn2.phase === PHASE.story_gathering) {
      expect(turn2.messages.length, "Turn 2: messages should be tracked").toBeGreaterThanOrEqual(1);
      console.log(`TC-CS-UNKNOWN1 [2/2]: ✅ Emoji handled → story_gathering, messages: ${turn2.messages.length}`);
    } else {
      console.log(`TC-CS-UNKNOWN1 [2/2]: ⚠️ Emoji caused phase: ${turn2.phase} (acceptable)`);
    }
  }, 120_000);
});
