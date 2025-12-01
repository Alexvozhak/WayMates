import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from "vitest";

import { postgresService } from "../../../src/facade/infrastructure/postgres.service.js";
import { ColdStartWorkflow } from "../../../src/facade/langchain/cold-start/cold-start-agent.js";
import { PHASE } from "../../../src/facade/langchain/cold-start/types.js";
import { setupSession, cleanupSession } from "../helpers/mcp-tool-helpers.js";
import { trackTestUser, cleanupAllTestUsers } from "../helpers/test-users-tracker.js";
import { UserStories } from "../../core/helpers/user-stories.js";

import { cleanupColdStart, generateStoryFromFixture } from "./helpers/cold-start-helpers.js";
import { FacadeTestContext } from "../helpers/test-context.js";

import type { SessionId } from "../../../src/facade/mcp-server/result.js";
import type { UserId } from "../../../src/shared/schemas.js";

const STORY_COMPLETION_TRIGGER = "\n\nГотово, это вся моя карьерная история.";

describe("Cold-Start Happy Path Tests (P1)", () => {
  let testSessionId: SessionId;
  const testUserId: UserId = "usr_happy_01933ec5-0000-0000-0000-000000000002";
  const threadId = `cold_start_${testUserId}`;

  const runWorkflow = (message: string) => new ColdStartWorkflow(testUserId).run(message, threadId);

  beforeAll(async () => {
    FacadeTestContext.initialize();
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
    await FacadeTestContext.getInstance().cleanup();
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
    const planResponse = await runWorkflow(storyWithTrigger);

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
    const extractionResponse = await runWorkflow("да, всё верно");

    // Agent должен вызвать confirm_plan → process_entity_batch → extraction началась
    if (extractionResponse.phase === PHASE.awaiting_context_confirmation) {
      console.log(
        `T06 [2/4]: ✅ Extraction started (context ${extractionResponse.progress.current}/${extractionResponse.progress.total})`,
      );
    } else if (extractionResponse.phase === PHASE.awaiting_clarification) {
      // Fallback: LLM не смог извлечь полностью → clarification
      console.log(`T06 [2/4]: ⚠️ Clarification needed (${extractionResponse.missingFields.length} fields)`);
      // Для T06 пропускаем clarification flow (будет в T07)
      expect.fail("T06 requires successful extraction without clarification (use simpler story or check LLM)");
    } else {
      expect.fail(`Unexpected phase after plan confirmation: ${extractionResponse.phase}`);
    }

    // ═══════════════════════════════════════════════════════════════
    // Phase 3: Loop через все contexts → awaiting_final_confirmation
    // ═══════════════════════════════════════════════════════════════

    console.log("T06 [3/4]: Confirming contexts → awaiting_final_confirmation");

    // Confirm first context (we're already at awaiting_context_confirmation)
    const firstContextConfirm = await runWorkflow("да, верно");

    // Business rule: After first context confirmation, we can be at:
    // - awaiting_context_confirmation (more contexts to extract)
    // - awaiting_final_confirmation (single context flow)

    let lastResponse = firstContextConfirm;

    // If multiple contexts, loop through them
    while (lastResponse.phase === PHASE.awaiting_context_confirmation) {
      const { current, total } = lastResponse.progress;
      console.log(`T06 [3/4]: Confirmed context ${current}/${total}, continuing...`);

      lastResponse = await runWorkflow("да, верно");
    }

    // After all contexts confirmed → должны быть в awaiting_final_confirmation
    expect(lastResponse.phase).toBe(PHASE.awaiting_final_confirmation);
    if (lastResponse.phase !== PHASE.awaiting_final_confirmation) {
      expect.fail(`Expected awaiting_final_confirmation after all contexts, got ${lastResponse.phase}`);
    }

    console.log(
      `T06 [3/4]: ✅ All contexts confirmed (${lastResponse.summary.contextsCount} contexts, ${lastResponse.summary.trailsCount} trails)`,
    );

    // ═══════════════════════════════════════════════════════════════
    // Phase 4: awaiting_final_confirmation → saved
    // ═══════════════════════════════════════════════════════════════

    console.log("T06 [4/4]: Final confirmation → saved");
    const savedResponse = await runWorkflow("сохрани");

    expect(savedResponse.phase).toBe(PHASE.saved);
    if (savedResponse.phase !== PHASE.saved) {
      expect.fail(`Expected saved, got ${savedResponse.phase}`);
    }
    expect(savedResponse.contexts.length).toBeGreaterThan(0);
    expect(savedResponse.userId).toBe(testUserId);

    console.log(`T06 [4/4]: ✅ Workflow complete! Saved ${savedResponse.contexts.length} contexts`);
  }, 240_000); // 4 min timeout for multi-context workflow

  /**
   * T03: Multi-context with trails (U10 fixture)
   *
   * Business rule: Cold-start должен корректно обрабатывать историю
   * с 3+ контекстами и trails между ними.
   *
   * U10 fixture:
   * - 3 contexts: junior → middle → senior
   * - 2 trails: typescript (udemy), system-design (coursera)
   *
   * Проверяем:
   * - Queue содержит >= 3 контекстов
   * - Saved response содержит >= 3 контекстов
   * - Trails корректно связаны с контекстами
   */
  it("T03: Multi-context (3+) → saved with U10 fixture", async () => {
    const userStories = new UserStories();
    const u10 = userStories.getStoryBy("U10"); // 3 contexts + 2 trails

    const story = await generateStoryFromFixture(u10);
    const storyWithTrigger = story + STORY_COMPLETION_TRIGGER;

    console.log("T03 [1/4]: Sending U10 story (3 contexts + 2 trails)");
    const planResponse = await runWorkflow(storyWithTrigger);

    if (planResponse.phase !== PHASE.awaiting_plan_confirmation) {
      expect.fail(`Expected awaiting_plan_confirmation, got ${planResponse.phase}`);
    }

    // Business assertion: должно быть минимум 3 контекста в queue
    expect(planResponse.queue.length).toBeGreaterThanOrEqual(3);
    console.log(`T03 [1/4]: ✅ Plan has ${planResponse.queue.length} contexts in queue`);

    // Check trails are mentioned in queue (incomingTrails)
    const contextsWithTrails = planResponse.queue.filter((q) => q.incomingTrails.length > 0);
    console.log(`T03 [1/4]: ${contextsWithTrails.length} contexts have incoming trails`);

    console.log("T03 [2/4]: Confirming plan...");
    let currentResponse = await runWorkflow("да, всё верно");

    // Loop through all contexts
    while (currentResponse.phase === PHASE.awaiting_context_confirmation) {
      console.log(
        `T03 [3/4]: Confirming context ${currentResponse.progress.current}/${currentResponse.progress.total}`,
      );
      currentResponse = await runWorkflow("да, верно");
    }

    if (currentResponse.phase === PHASE.awaiting_clarification) {
      console.log("T03: ⚠️ Clarification needed, cannot complete test deterministically");
      expect.fail("T03 requires extraction without clarification");
    }

    if (currentResponse.phase !== PHASE.awaiting_final_confirmation) {
      expect.fail(`Expected awaiting_final_confirmation, got ${currentResponse.phase}`);
    }

    // Business assertion: summary should show >= 3 contexts
    expect(currentResponse.summary.contextsCount).toBeGreaterThanOrEqual(3);
    console.log(
      `T03 [3/4]: ✅ Final summary: ${currentResponse.summary.contextsCount} contexts, ${currentResponse.summary.trailsCount} trails`,
    );

    console.log("T03 [4/4]: Final confirmation → saved");
    const savedResponse = await runWorkflow("сохрани");

    expect(savedResponse.phase).toBe(PHASE.saved);
    if (savedResponse.phase !== PHASE.saved) {
      expect.fail(`Expected saved, got ${savedResponse.phase}`);
    }

    // Business assertion: saved contexts >= 3
    expect(savedResponse.contexts.length).toBeGreaterThanOrEqual(3);
    console.log(`T03 [4/4]: ✅ Saved ${savedResponse.contexts.length} contexts`);
  }, 300_000); // 5 min timeout for complex workflow

  /**
   * T07: Trails extraction with correct links
   *
   * Business rule: Trails должны быть корректно связаны с контекстами
   * через fromContextId и toContextId.
   *
   * U10 fixture trails:
   * - Trail 1: typescript (junior → middle)
   * - Trail 2: system-design (middle → senior)
   *
   * Проверяем:
   * - Trails присутствуют в saved response (минимум 1)
   * - Trails имеют skill и platform
   * - Trails связаны с контекстами (не null fromContextId/toContextId)
   *
   * ВАЖНО: Это НЕ строгий тест "извлечь все 2 trails" — LLM может
   * извлечь 1 из 2. Но если 0 — это regression.
   */
  // eslint-disable-next-line complexity -- integration test with sequential steps
  it("T07: Trails extraction with correct context links", async () => {
    const userStories = new UserStories();
    const u10 = userStories.getStoryBy("U10"); // 3 contexts + 2 trails

    const story = await generateStoryFromFixture(u10);
    const storyWithTrigger = story + STORY_COMPLETION_TRIGGER;

    console.log("T07 [1/4]: Sending U10 story for trails extraction");
    const planResponse = await runWorkflow(storyWithTrigger);

    if (planResponse.phase !== PHASE.awaiting_plan_confirmation) {
      expect.fail(`Expected awaiting_plan_confirmation, got ${planResponse.phase}`);
    }

    // Check that plan mentions trails (incomingTrails in queue)
    const totalIncomingTrails = planResponse.queue.reduce((sum, q) => sum + q.incomingTrails.length, 0);
    console.log(`T07 [1/4]: Plan queue has ${totalIncomingTrails} total incoming trail references`);

    console.log("T07 [2/4]: Confirming plan...");
    let currentResponse = await runWorkflow("да, всё верно");

    // Loop through all contexts
    while (currentResponse.phase === PHASE.awaiting_context_confirmation) {
      console.log(
        `T07 [3/4]: Confirming context ${currentResponse.progress.current}/${currentResponse.progress.total}`,
      );

      // Log and verify trails for this context
      const trails = currentResponse.relatedTrails;
      if (trails.length > 0) {
        console.log(`T07 [3/4]: Context has ${trails.length} related trail(s)`);
      }
      // Verify trail structure (assertions MUST pass for any extracted trails)
      for (const trail of trails) {
        expect(trail.skill).toBeDefined();
        expect(trail.platform).toBeDefined();
      }

      currentResponse = await runWorkflow("да, верно");
    }

    if (currentResponse.phase === PHASE.awaiting_clarification) {
      console.log("T07: ⚠️ Clarification needed, cannot complete test deterministically");
      expect.fail("T07 requires extraction without clarification");
    }

    if (currentResponse.phase !== PHASE.awaiting_final_confirmation) {
      expect.fail(`Expected awaiting_final_confirmation, got ${currentResponse.phase}`);
    }

    // Check trails in final summary
    console.log(`T07 [3/4]: Summary shows ${currentResponse.summary.trailsCount} trails`);

    console.log("T07 [4/4]: Final confirmation → saved");
    const savedResponse = await runWorkflow("сохрани");

    expect(savedResponse.phase).toBe(PHASE.saved);
    if (savedResponse.phase !== PHASE.saved) {
      expect.fail(`Expected saved, got ${savedResponse.phase}`);
    }

    // ═══════════════════════════════════════════════════════════════════
    // BUSINESS ASSERTIONS — эти проверки ДОЛЖНЫ падать при regression
    // ═══════════════════════════════════════════════════════════════════

    // U10 has 2 trails — LLM should extract at least 1
    // Если 0 — это regression в extraction или System Prompt
    expect(savedResponse.trails.length).toBeGreaterThanOrEqual(1);
    console.log(`T07 [4/4]: ✅ Saved ${savedResponse.trails.length} trail(s) (expected >= 1)`);

    // Verify each trail has required structure
    for (const trail of savedResponse.trails) {
      expect(trail.trailId).toMatch(/^trl_/);
      expect(trail.skill).toBeDefined();
      expect(trail.platform).toBeDefined();

      // At least one of fromContextId/toContextId should be set
      const hasContextLink = trail.fromContextId || trail.toContextId;
      expect(hasContextLink).toBeTruthy();
      console.log(`T07 [4/4]: Trail "${trail.skill}" has context link: ${hasContextLink ? "✅" : "❌"}`);

      // If fromContextId is set, verify it references a saved context
      if (trail.fromContextId) {
        const fromExists = savedResponse.contexts.some((c) => c.contextId === trail.fromContextId);
        expect(fromExists).toBe(true);
      }

      // If toContextId is set, verify it references a saved context
      if (trail.toContextId) {
        const toExists = savedResponse.contexts.some((c) => c.contextId === trail.toContextId);
        expect(toExists).toBe(true);
      }
    }
  }, 300_000); // 5 min timeout for complex workflow
});
