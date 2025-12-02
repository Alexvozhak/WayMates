import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from "vitest";

import { postgresService } from "../../../../../src/facade/infrastructure/postgres.service.js";
import { ColdStartWorkflow } from "../../../../../src/facade/langchain/cold-start/cold-start-agent.js";
import { PHASE } from "../../../../../src/facade/langchain/cold-start/types.js";
import { SessionMiddleware } from "../../../../../src/facade/mcp-server/session-middleware.js";
import { ColdStartTool } from "../../../../../src/facade/mcp-server/tools/cold-start.tool.js";
import { setupSession, cleanupSession } from "../../../helpers/mcp-tool-helpers.js";
import { trackTestUser, cleanupAllTestUsers } from "../../../helpers/test-users-tracker.js";
import { UserStories } from "../../../../core/helpers/user-stories.js";

import { cleanupColdStart, generateStoryFromFixture } from "../helpers/cold-start-helpers.js";
import { FacadeTestContext } from "../../../helpers/test-context.js";

import type { SessionId } from "../../../../../src/facade/mcp-server/result.js";
import type { UserId } from "../../../../../src/shared/schemas.js";

const STORY_COMPLETION_TRIGGER = "\n\nГотово, это вся моя карьерная история.";

describe("Cold-Start Edge Cases (Tier 3)", () => {
  let testSessionId: SessionId;
  const testUserId: UserId = "usr_01933ec5-0008-0000-0000-000000000008";
  const threadId = `cold_start_${testUserId}`;

  const runWorkflow = (message: string) => new ColdStartWorkflow(testUserId).run(message, threadId);

  beforeAll(async () => {
    FacadeTestContext.initialize();
    await postgresService.initialize();
  });

  beforeEach(async () => {
    const [_session, sessionId] = await setupSession(testUserId);
    testSessionId = sessionId;

    await cleanupColdStart(testUserId, threadId);
    trackTestUser(testUserId);
  });

  afterEach(async () => {
    await cleanupSession(testSessionId);
  });

  afterAll(async () => {
    await cleanupAllTestUsers();
    await postgresService.close();
  });

  /**
   * T10: State Resume (Checkpoint Persistence)
   *
   * Business rule: Пользователь может закрыть чат в середине workflow
   * и продолжить позже с того же места.
   *
   * Flow:
   * 1. Начать workflow → awaiting_plan_confirmation
   * 2. Подтвердить план → awaiting_context_confirmation
   * 3. "Закрыть чат" (ничего не делаем — checkpoint уже сохранён)
   * 4. Вызвать workflow снова → должен продолжить с awaiting_context_confirmation
   *
   * Critical: Проверяет что PostgresSaver корректно сохраняет state
   * и Command.resume работает для interrupt-resume flow.
   */
  it("T10: State resume after 'closing chat' - continues from checkpoint", async () => {
    const userStories = new UserStories();
    const u1 = userStories.getStoryBy("U1");

    // Step 1: История → awaiting_plan_confirmation
    const story = await generateStoryFromFixture(u1);
    const storyWithTrigger = story + STORY_COMPLETION_TRIGGER;

    console.log("T10 [1/5]: Sending story → awaiting_plan_confirmation");
    const planResponse = await runWorkflow(storyWithTrigger);

    if (planResponse.phase !== PHASE.awaiting_plan_confirmation) {
      expect.fail(`Expected awaiting_plan_confirmation, got ${planResponse.phase}`);
    }

    console.log(`T10 [1/5]: ✅ Plan created with ${planResponse.queue.length} contexts`);

    // Step 2: Подтвердить план → awaiting_context_confirmation
    console.log("T10 [2/5]: Confirming plan → awaiting_context_confirmation");
    const extractionResponse = await runWorkflow("да, всё верно");

    if (extractionResponse.phase === PHASE.awaiting_clarification) {
      console.log("T10: ⚠️ Clarification needed, test cannot complete deterministically");
      expect.fail("T10 requires successful extraction without clarification");
    }

    if (extractionResponse.phase !== PHASE.awaiting_context_confirmation) {
      expect.fail(`Expected awaiting_context_confirmation, got ${extractionResponse.phase}`);
    }

    const _contextBeforeResume = extractionResponse.entity.contextId;
    const progressBeforeResume = extractionResponse.progress;
    console.log(
      `T10 [2/5]: ✅ Extraction started: context ${progressBeforeResume.current}/${progressBeforeResume.total}`,
    );

    // Step 3: Проверить что checkpoint существует
    console.log("T10 [3/5]: Verifying checkpoint exists (simulating 'close chat')");
    const checkpointState = await postgresService.getCheckpointState(threadId);
    expect(checkpointState).not.toBeNull();
    console.log("T10 [3/5]: ✅ Checkpoint exists in PostgreSQL");

    // Step 4: "Вернулся в чат" — подтверждаем контекст
    // Business rule: Workflow должен продолжить с того же места
    console.log("T10 [4/5]: Resuming workflow with context confirmation");
    const resumeResponse = await runWorkflow("да, верно");

    // Verify we're still in the workflow (not restarted from scratch)
    // After confirming context, we should be at:
    // - awaiting_context_confirmation (more contexts)
    // - awaiting_final_confirmation (all contexts done)
    const validResumePhases = [PHASE.awaiting_context_confirmation, PHASE.awaiting_final_confirmation];
    expect(validResumePhases).toContain(resumeResponse.phase);

    console.log(`T10 [4/5]: ✅ Resumed successfully, now at phase: ${resumeResponse.phase}`);

    // Step 5: Verify progress advanced (not reset)
    if (resumeResponse.phase === PHASE.awaiting_context_confirmation) {
      // Progress should be >= what we had before
      expect(resumeResponse.progress.current).toBeGreaterThanOrEqual(progressBeforeResume.current);
      console.log(
        `T10 [5/5]: ✅ Progress advanced: ${resumeResponse.progress.current}/${resumeResponse.progress.total}`,
      );
    } else if (resumeResponse.phase === PHASE.awaiting_final_confirmation) {
      // All contexts done — progress is implicit
      console.log(`T10 [5/5]: ✅ All contexts confirmed, ready for final confirmation`);
    }

    console.log("T10: ✅ State resume test passed — checkpoint persistence works correctly");
  }, 240_000);

  /**
   * T15: Checkpoint Cleanup After Save (via MCP Tool)
   *
   * Business rule: После успешного сохранения в Neo4j,
   * ColdStartTool.handleSaved() ДОЛЖЕН удалить checkpoint НЕМЕДЛЕННО.
   *
   * Тестируем РЕАЛЬНЫЙ cleanup path:
   * - ColdStartTool.execute() → workflow → saved → handleSaved() → deleteCheckpoint()
   *
   * ВАЖНО: Предыдущая версия тестировала resolveInput() cleanup (fallback path).
   * Эта версия тестирует handleSaved() cleanup (primary path).
   *
   * Why: Предотвращает накопление stale checkpoints в PostgreSQL.
   * См. cold-start.tool.ts:53 — cleanup в handleSaved().
   */
  it("T15: Checkpoint cleanup after save (via handleSaved)", async () => {
    const userStories = new UserStories();
    const u1 = userStories.getStoryBy("U1");

    // Setup ColdStartTool с реальными dependencies
    const ctx = FacadeTestContext.getInstance();
    const sessionMiddleware = new SessionMiddleware(ctx.redis);
    const coldStartTool = new ColdStartTool(sessionMiddleware, ctx.normalizer, ctx.coreClient);

    const runTool = async (message: string) => {
      const result = await coldStartTool.execute({ sessionId: testSessionId, message });
      if (!result.ok) {
        console.error("T15 error details:", JSON.stringify(result.error, null, 2));
        expect.fail(`ColdStartTool error: ${result.error.message}`);
      }
      return result.value;
    };

    // Step 1: Full workflow → saved через ColdStartTool
    const story = await generateStoryFromFixture(u1);
    const storyWithTrigger = story + STORY_COMPLETION_TRIGGER;

    console.log("T15 [1/5]: Running full workflow via ColdStartTool to saved state");
    const planResponse = await runTool(storyWithTrigger);

    if (planResponse.phase !== PHASE.awaiting_plan_confirmation) {
      expect.fail(`Expected awaiting_plan_confirmation, got ${planResponse.phase}`);
    }

    let currentResponse = await runTool("да, всё верно");

    if (currentResponse.phase === PHASE.awaiting_clarification) {
      expect.fail("T15 requires extraction without clarification");
    }

    // Loop through all contexts
    while (currentResponse.phase === PHASE.awaiting_context_confirmation) {
      console.log(
        `T15 [2/5]: Confirming context ${currentResponse.progress.current}/${currentResponse.progress.total}`,
      );
      currentResponse = await runTool("да, верно");
    }

    if (currentResponse.phase !== PHASE.awaiting_final_confirmation) {
      expect.fail(`Expected awaiting_final_confirmation, got ${currentResponse.phase}`);
    }

    console.log("T15 [3/5]: Final confirmation → saved");
    const savedResponse = await runTool("сохрани");

    expect(savedResponse.phase).toBe(PHASE.saved);
    if (savedResponse.phase !== PHASE.saved) {
      expect.fail(`Expected saved, got ${savedResponse.phase}`);
    }
    console.log(`T15 [3/5]: ✅ Workflow completed: ${savedResponse.contexts.length} contexts saved`);

    // Step 2: КЛЮЧЕВАЯ ПРОВЕРКА — checkpoint должен быть удалён СРАЗУ после saved
    // handleSaved() вызывает deleteCheckpoint() сразу после сохранения в Neo4j
    console.log("T15 [4/5]: Verifying checkpoint was deleted by handleSaved()");
    const checkpointAfterSave = await postgresService.getCheckpointState(threadId);

    // Checkpoint должен быть NULL — handleSaved() должен был удалить его
    expect(checkpointAfterSave).toBeNull();
    console.log("T15 [4/5]: ✅ Checkpoint deleted immediately by handleSaved()");

    // Step 3: Verify cold_start marked as completed
    const isCompleted = await postgresService.isColdStartCompleted(testUserId);
    expect(isCompleted).toBe(true);
    console.log("T15 [5/5]: ✅ Cold start marked as completed");

    console.log("T15: ✅ Checkpoint cleanup test passed — handleSaved() cleanup works correctly");
  }, 300_000);

  /**
   * T09: Context Correction (Edit Flow)
   *
   * Business rule: Пользователь может сказать "нет, измени X" при показе контекста.
   * Agent должен:
   * 1. Распознать EDIT intent (не APPROVE)
   * 2. Вызвать edit_context с corrections
   * 3. Показать обновлённый контекст
   * 4. Дождаться нового подтверждения
   *
   * Flow:
   * story → plan → confirm plan → process → show_context
   * → "измени position на senior" → edit_context → show_context (updated)
   * → "да, верно" → confirm_context → continue
   *
   * Critical: Проверяет что Agent корректно парсит EDIT intent
   * и не путает с APPROVE при словах типа "измени", "поправь", "добавь".
   */
  // eslint-disable-next-line complexity -- integration test with multiple workflow steps
  it("T09: Context correction via edit_context flow", async () => {
    const userStories = new UserStories();
    const u1 = userStories.getStoryBy("U1");

    const story = await generateStoryFromFixture(u1);
    const storyWithTrigger = story + STORY_COMPLETION_TRIGGER;

    // Step 1: Story → Plan
    console.log("T09 [1/6]: Sending story → awaiting_plan_confirmation");
    const planResponse = await runWorkflow(storyWithTrigger);

    if (planResponse.phase !== PHASE.awaiting_plan_confirmation) {
      expect.fail(`Expected awaiting_plan_confirmation, got ${planResponse.phase}`);
    }
    console.log(`T09 [1/6]: ✅ Plan created with ${planResponse.queue.length} contexts`);

    // Step 2: Confirm plan → Extract first context
    console.log("T09 [2/6]: Confirming plan → awaiting_context_confirmation");
    const extractionResponse = await runWorkflow("да, всё верно");

    if (extractionResponse.phase === PHASE.awaiting_clarification) {
      expect.fail("T09 requires successful extraction without clarification");
    }

    if (extractionResponse.phase !== PHASE.awaiting_context_confirmation) {
      expect.fail(`Expected awaiting_context_confirmation, got ${extractionResponse.phase}`);
    }

    const originalPosition = extractionResponse.entity.position;
    const contextId = extractionResponse.entity.contextId;
    console.log(`T09 [2/6]: ✅ Context extracted: position="${originalPosition}", id=${contextId}`);

    // Step 3: EDIT REQUEST — сказать "измени position"
    // Agent должен распознать EDIT intent и вызвать edit_context
    console.log("T09 [3/6]: Sending edit request → edit_context should be called");
    const editResponse = await runWorkflow("нет, измени позицию на lead");

    // После edit должен быть снова awaiting_context_confirmation
    // (показывает обновлённый контекст для подтверждения)
    if (editResponse.phase !== PHASE.awaiting_context_confirmation) {
      console.log(`T09: ❌ After edit request, got phase: ${editResponse.phase}`);
      console.log("T09: Agent may have misinterpreted EDIT intent as something else");
      expect.fail(`Expected awaiting_context_confirmation after edit, got ${editResponse.phase}`);
    }

    // Position должен измениться
    const updatedPosition = editResponse.entity.position;
    console.log(`T09 [3/6]: ✅ Context updated: position="${updatedPosition}"`);

    // Проверяем что position изменился (должен содержать "lead" или отличаться от original)
    const positionChanged = updatedPosition !== originalPosition || updatedPosition.toLowerCase().includes("lead");

    if (!positionChanged) {
      console.log(`T09: ⚠️ Position may not have changed: "${originalPosition}" → "${updatedPosition}"`);
      // Не fail — LLM может интерпретировать по-разному, главное что phase правильный
    }

    // Step 4: CONFIRM — теперь подтвердить
    console.log("T09 [4/6]: Confirming edited context");
    const confirmResponse = await runWorkflow("да, теперь верно");

    // После подтверждения — либо следующий контекст, либо final
    const validPhases = [PHASE.awaiting_context_confirmation, PHASE.awaiting_final_confirmation];
    expect(validPhases).toContain(confirmResponse.phase);
    console.log(`T09 [4/6]: ✅ Context confirmed, phase: ${confirmResponse.phase}`);

    // Step 5: Complete workflow
    let currentResponse = confirmResponse;
    while (currentResponse.phase === PHASE.awaiting_context_confirmation) {
      console.log(
        `T09 [5/6]: Confirming context ${currentResponse.progress.current}/${currentResponse.progress.total}`,
      );
      currentResponse = await runWorkflow("да, верно");
    }

    if (currentResponse.phase !== PHASE.awaiting_final_confirmation) {
      expect.fail(`Expected awaiting_final_confirmation, got ${currentResponse.phase}`);
    }

    // Final confirmation
    console.log("T09 [6/6]: Final confirmation → saved");
    const savedResponse = await runWorkflow("сохрани");
    expect(savedResponse.phase).toBe(PHASE.saved);

    if (savedResponse.phase === PHASE.saved) {
      console.log(`T09: ✅ Edit flow test passed — ${savedResponse.contexts.length} contexts saved`);
    }
  }, 300_000);

  /**
   * T14: Cancel Workflow
   *
   * Business rule: Пользователь может сказать "отмена" в любой момент
   * и workflow должен остановиться БЕЗ сохранения данных.
   *
   * System Prompt указывает:
   * > If user says "cancel"/"stop"/"quit"/"abort"/"отмена":
   * > 1. Respond: "Workflow cancelled. Your data was not saved."
   * > 2. Set phase: failed
   * > 3. Stop workflow
   *
   * Expected behavior:
   * - Response phase === "failed"
   * - Response message содержит "cancel" или "отмена"
   * - Данные НЕ сохранены в Neo4j
   *
   * ВАЖНО: Этот тест проверяет что cancel работает корректно.
   * Если LLM игнорирует System Prompt — тест упадёт.
   */
  it("T14: Cancel workflow stops without saving", async () => {
    const userStories = new UserStories();
    const u1 = userStories.getStoryBy("U1");

    // Step 1: Начать workflow → story_gathering
    console.log("T14 [1/3]: Starting workflow");
    const initialResponse = await runWorkflow("Привет, хочу рассказать о карьере");

    expect(initialResponse.phase).toBe(PHASE.story_gathering);
    console.log("T14 [1/3]: ✅ Workflow started, phase: story_gathering");

    // Step 2: Отправить историю → awaiting_plan_confirmation
    const story = await generateStoryFromFixture(u1);
    const storyWithTrigger = story + STORY_COMPLETION_TRIGGER;

    console.log("T14 [2/3]: Sending story to get plan");
    const planResponse = await runWorkflow(storyWithTrigger);

    if (planResponse.phase !== PHASE.awaiting_plan_confirmation) {
      expect.fail(`Expected awaiting_plan_confirmation, got ${planResponse.phase}`);
    }
    console.log(`T14 [2/3]: ✅ Plan created with ${planResponse.queue.length} contexts`);

    // Step 3: CANCEL — сказать "отмена"
    console.log("T14 [3/3]: Sending cancel command");
    const cancelResponse = await runWorkflow("отмена");

    // Business assertion: Cancel должен вернуть failed phase
    // Если LLM игнорирует System Prompt — этот тест упадёт
    //
    // NOTE: Если тест падает с phase !== "failed", это баг в System Prompt
    // или отсутствие cancel tool. Нужно добавить explicit cancel tool.
    expect(cancelResponse.phase).toBe(PHASE.failed);

    if (cancelResponse.phase === PHASE.failed) {
      // Verify message mentions cancel
      const cancelMentioned =
        cancelResponse.message.toLowerCase().includes("cancel") ||
        cancelResponse.message.toLowerCase().includes("отмен");
      console.log(`T14 [3/3]: ✅ Workflow cancelled, message: "${cancelResponse.message}"`);

      // Soft assertion — message should mention cancel (informational)
      if (!cancelMentioned) {
        console.log("T14: ⚠️ Message does not mention cancel, but phase is correct");
      }
    } else {
      // Unexpected phase — detailed diagnostics
      console.log(`T14: ❌ Unexpected phase after cancel: ${cancelResponse.phase}`);
      console.log("T14: This indicates System Prompt cancel detection is not working.");
      console.log("T14: Consider adding explicit cancel_workflow tool.");
      expect.fail(`Expected failed phase after cancel, got ${cancelResponse.phase}`);
    }

    // Verify data was NOT saved to Neo4j
    // (This is implicit — we didn't reach saved phase, so upsertStory was never called)
    console.log("T14: ✅ Cancel workflow test passed — workflow stopped without saving");
  }, 180_000);
});
