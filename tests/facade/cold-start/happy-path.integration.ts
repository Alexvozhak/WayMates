import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from "vitest";

import { postgresService } from "../../../src/facade/infrastructure/postgres.service.js";
import { runColdStartWorkflow } from "../../../src/facade/langchain/cold-start/cold-start-agent.js";
import { setupSession, cleanupSession } from "../helpers/mcp-tool-helpers.js";
import { trackTestUser, cleanupAllTestUsers } from "../helpers/test-users-tracker.js";
import { UserStories } from "../../core/helpers/user-stories.js";

import { cleanupColdStart, generateStoryFromFixture } from "./helpers/cold-start-helpers.js";
import { PHASE } from "../../../src/facade/langchain/cold-start/types.js";

import type { SessionId } from "../../../src/facade/mcp-server/result.js";
import type { UserId } from "../../../src/shared/schemas.js";

const STORY_COMPLETION_TRIGGER = "\n\nГотово, это вся моя карьерная история.";

describe("Cold-Start Happy Path Tests (P1)", () => {
  let testSessionId: SessionId;
  const testUserId: UserId = "usr_happy_01933ec5-0000-0000-0000-000000000002";
  const threadId = `cold_start_${testUserId}`;

  beforeAll(async () => {
    await postgresService.initialize();
  });

  beforeEach(async () => {
    const [_session, sessionId] = await setupSession(testUserId);
    testSessionId = sessionId;

    await cleanupColdStart(testUserId, threadId, sessionId);
    trackTestUser(testUserId);
  });

  afterEach(async () => {
    await cleanupSession(testSessionId);
  });

  afterAll(async () => {
    await cleanupAllTestUsers();
    await postgresService.close();
  });

  // T06: Full phase transitions (story → plan → context → final → saved)
  it("T06: Full workflow phase transitions", async () => {
    // Business rule: Cold-start workflow должен пройти все фазы от story до saved.
    // Проверяет что Agent корректно чейнит tools и парсит user intents.
    //
    // Flow:
    // 1. story_gathering → plan (via "готово")
    // 2. awaiting_plan_confirmation → extraction (via "да")
    // 3. awaiting_context_confirmation → final (via "да", single context)
    // 4. awaiting_final_confirmation → saved (via "сохрани")

    const userStories = new UserStories();
    const u1 = userStories.getStoryBy("U1"); // 2 contexts

    // ═══════════════════════════════════════════════════════════════
    // Phase 1: story_gathering → awaiting_plan_confirmation
    // ═══════════════════════════════════════════════════════════════

    const story = await generateStoryFromFixture(u1);
    const storyWithTrigger = story + STORY_COMPLETION_TRIGGER;

    console.log("T06 [1/4]: Sending story → awaiting_plan_confirmation");
    const planResponse = await runColdStartWorkflow(storyWithTrigger, threadId, testUserId);

    expect(planResponse.phase).toBe(PHASE.awaiting_plan_confirmation);
    if (planResponse.phase !== PHASE.awaiting_plan_confirmation) {
      expect.fail(`Expected awaiting_plan_confirmation, got ${planResponse.phase}`);
    }
    expect(planResponse.queue.length).toBeGreaterThan(0);

    console.log(`T06 [1/4]: ✅ Plan created with ${planResponse.queue.length} contexts`);

    // ═══════════════════════════════════════════════════════════════
    // Phase 2: awaiting_plan_confirmation → awaiting_context_confirmation
    // ═══════════════════════════════════════════════════════════════

    console.log("T06 [2/4]: Confirming plan → awaiting_context_confirmation");
    const extractionResponse = await runColdStartWorkflow("да, всё верно", threadId, testUserId);

    // Agent должен вызвать confirm_plan → process_entity_batch → extraction началась
    if (extractionResponse.phase === PHASE.awaiting_context_confirmation) {
      console.log(
        `T06 [2/4]: ✅ Extraction started (context ${extractionResponse.progress.current}/${extractionResponse.progress.total})`,
      );
    } else if (extractionResponse.phase === PHASE.awaiting_clarification) {
      // Fallback: LLM не смог извлечь полностью → clarification
      console.log(
        `T06 [2/4]: ⚠️ Clarification needed (${extractionResponse.missingFields.length} fields)`,
      );
      // Для T06 пропускаем clarification flow (будет в T07)
      expect.fail(
        "T06 requires successful extraction without clarification (use simpler story or check LLM)",
      );
    } else {
      expect.fail(`Unexpected phase after plan confirmation: ${extractionResponse.phase}`);
    }

    // ═══════════════════════════════════════════════════════════════
    // Phase 3: Loop через все contexts → awaiting_final_confirmation
    // ═══════════════════════════════════════════════════════════════

    console.log("T06 [3/4]: Confirming contexts → awaiting_final_confirmation");

    // Confirm first context (we're already at awaiting_context_confirmation)
    const firstContextConfirm = await runColdStartWorkflow("да, верно", threadId, testUserId);

    // Business rule: After first context confirmation, we can be at:
    // - awaiting_context_confirmation (more contexts to extract)
    // - awaiting_final_confirmation (single context flow)

    let lastResponse = firstContextConfirm;

    // If multiple contexts, loop through them
    while (lastResponse.phase === PHASE.awaiting_context_confirmation) {
      const { current, total } = lastResponse.progress;
      console.log(`T06 [3/4]: Confirmed context ${current}/${total}, continuing...`);

      lastResponse = await runColdStartWorkflow("да, верно", threadId, testUserId);
    }

    // After all contexts confirmed → должны быть в awaiting_final_confirmation
    expect(lastResponse.phase).toBe(PHASE.awaiting_final_confirmation);
    if (lastResponse.phase !== PHASE.awaiting_final_confirmation) {
      expect.fail(
        `Expected awaiting_final_confirmation after all contexts, got ${lastResponse.phase}`,
      );
    }

    console.log(
      `T06 [3/4]: ✅ All contexts confirmed (${lastResponse.summary.contextsCount} contexts, ${lastResponse.summary.trailsCount} trails)`,
    );

    // ═══════════════════════════════════════════════════════════════
    // Phase 4: awaiting_final_confirmation → saved
    // ═══════════════════════════════════════════════════════════════

    console.log("T06 [4/4]: Final confirmation → saved");
    const savedResponse = await runColdStartWorkflow("сохрани", threadId, testUserId);

    expect(savedResponse.phase).toBe(PHASE.saved);
    if (savedResponse.phase !== PHASE.saved) {
      expect.fail(`Expected saved, got ${savedResponse.phase}`);
    }
    expect(savedResponse.contexts.length).toBeGreaterThan(0);
    expect(savedResponse.userId).toBe(testUserId);

    console.log(`T06 [4/4]: ✅ Workflow complete! Saved ${savedResponse.contexts.length} contexts`);
  }, 240_000); // 4 min timeout for multi-context workflow
});
