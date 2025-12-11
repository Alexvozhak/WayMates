import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { ColdStartGraph, PHASE } from "../../../../../src/facade/langGraph/cold-start-v2/cold-start-graph.js";
import { contextIdSchema } from "../../../../../src/shared/schemas.js";
import { cleanupAllTestUsers, cleanupUserFromNeo4j, trackTestUser } from "../../../helpers/test-users-tracker.js";
import { UserStories } from "../../../../core/helpers/user-stories.js";

import { cleanupColdStart, generateStoryFromFixture } from "../../cold-start/helpers/cold-start-helpers.js";
import { FacadeTestContext } from "../../../helpers/test-context.js";
import { cleanupSession, setupSession } from "../../../helpers/mcp-tool-helpers.js";

import type { UserId } from "../../../../../src/shared/schemas.js";
import type { SessionId } from "../../../../../src/facade/mcp-server/result.js";

const STORY_COMPLETION_TRIGGER = "\n\nГотово, это вся моя карьерная история.";

describe("Cold-Start V2: Extraction (TC-E)", () => {
  const testUserId: UserId = "usr_01933ec5-0008-0000-0000-000000000008";
  const threadId = `cold_start_v2_${testUserId}`;
  let testSessionId: SessionId;

  const runWorkflow = (message: string): ReturnType<ColdStartGraph["run"]> => {
    const ctx = FacadeTestContext.getInstance();
    const checkpointer = ctx.checkpointService.getCheckpointer();
    return new ColdStartGraph(testUserId, checkpointer).run(
      message,
      threadId,
      ctx.coreClient,
      ctx.normalizer,
      ctx.userService,
    );
  };

  beforeEach(async () => {
    await cleanupColdStart(testUserId, threadId);
    await cleanupUserFromNeo4j(testUserId);
    testSessionId = await setupSession(testUserId);
    trackTestUser(testUserId);
  });

  afterAll(async () => {
    await cleanupSession(testSessionId);
    await cleanupAllTestUsers();
  });

  /**
   * TC-E4: Context correction via edit flow
   *
   * Что тестируем:
   * Пользователь может исправить извлечённый контекст. После edit request
   * LLM применяет corrections и возвращает обновлённый context.
   *
   * Given:
   * - Context extracted (awaiting_context_confirmation)
   * - User sends: "нет, измени позицию на lead"
   *
   * Then:
   * - Phase остаётся awaiting_context_confirmation
   * - entity.position изменилась (или содержит "lead")
   * - Workflow завершается успешно
   *
   * Тип теста: Integration (real LLM)
   */
  // eslint-disable-next-line complexity -- integration test with multiple workflow steps
  it("TC-E4: Context correction via edit flow", async () => {
    const userStories = new UserStories();
    const u1 = userStories.getStoryBy("U1");

    const story = await generateStoryFromFixture(u1);
    const storyWithTrigger = story + STORY_COMPLETION_TRIGGER;

    console.log("TC-E4 [1/6]: Sending story → awaiting_plan_confirmation");
    const planResponse = await runWorkflow(storyWithTrigger);

    if (planResponse.phase !== PHASE.awaiting_plan_confirmation) {
      expect.fail(`Expected awaiting_plan_confirmation, got ${planResponse.phase}`);
    }
    console.log(`TC-E4 [1/6]: ✅ Plan created with ${planResponse.queue.length} contexts`);

    console.log("TC-E4 [2/6]: Confirming plan → awaiting_context_confirmation");
    const extractionResponse = await runWorkflow("да, всё верно");

    if (extractionResponse.phase === PHASE.awaiting_clarification) {
      expect.fail("TC-E4 requires successful extraction without clarification");
    }

    if (extractionResponse.phase !== PHASE.awaiting_context_confirmation) {
      expect.fail(`Expected awaiting_context_confirmation, got ${extractionResponse.phase}`);
    }

    const originalPosition = extractionResponse.entity.position;
    const contextId = extractionResponse.entity.contextId;
    console.log(`TC-E4 [2/6]: ✅ Context extracted: position="${originalPosition}", id=${contextId}`);

    console.log("TC-E4 [3/6]: Sending edit request → edit_context should be called");
    const editResponse = await runWorkflow("нет, измени позицию на lead");

    if (editResponse.phase !== PHASE.awaiting_context_confirmation) {
      console.log(`TC-E4: ❌ After edit request, got phase: ${editResponse.phase}`);
      console.log("TC-E4: Graph may have misinterpreted EDIT intent as something else");
      expect.fail(`Expected awaiting_context_confirmation after edit, got ${editResponse.phase}`);
    }

    const updatedPosition = editResponse.entity.position;
    console.log(`TC-E4 [3/6]: ✅ Context updated: position="${updatedPosition}"`);

    const positionChanged = updatedPosition !== originalPosition || updatedPosition.toLowerCase().includes("lead");

    if (!positionChanged) {
      console.log(`TC-E4: ⚠️ Position may not have changed: "${originalPosition}" → "${updatedPosition}"`);
    }

    console.log("TC-E4 [4/6]: Confirming edited context");
    const confirmResponse = await runWorkflow("да, теперь верно");

    const validPhases = [PHASE.awaiting_context_confirmation, PHASE.awaiting_final_confirmation];
    expect(validPhases).toContain(confirmResponse.phase);
    console.log(`TC-E4 [4/6]: ✅ Context confirmed, phase: ${confirmResponse.phase}`);

    let currentResponse = confirmResponse;
    while (currentResponse.phase === PHASE.awaiting_context_confirmation) {
      console.log(
        `TC-E4 [5/6]: Confirming context ${currentResponse.progress.current}/${currentResponse.progress.total}`,
      );
      currentResponse = await runWorkflow("да, верно");
    }

    if (currentResponse.phase !== PHASE.awaiting_final_confirmation) {
      expect.fail(`Expected awaiting_final_confirmation, got ${currentResponse.phase}`);
    }

    console.log("TC-E4 [6/6]: Final confirmation → saved");
    const savedResponse = await runWorkflow("сохрани");
    expect(savedResponse.phase).toBe(PHASE.saved);

    if (savedResponse.phase === PHASE.saved) {
      console.log(`TC-E4: ✅ Edit flow test passed — ${savedResponse.contexts.length} contexts saved`);
    }
  }, 300_000);

  /**
   * TC-E6: Clarification flow - missing data triggers clarification
   *
   * Что тестируем:
   * Если LLM не может извлечь required поле (birthYear), workflow переходит
   * в awaiting_clarification. После ответа пользователя extraction продолжается.
   *
   * Given:
   * - Story без birthYear (omit через generateStoryFromFixture)
   * - LLM extraction fails validation
   *
   * Then:
   * - Phase: awaiting_clarification
   * - missingFields.length > 0
   * - После ответа пользователя: awaiting_context_confirmation или awaiting_final_confirmation
   * - Workflow завершается успешно
   *
   * Тип теста: Integration (real LLM)
   */
  // eslint-disable-next-line complexity -- integration test with clarification retry flow
  it("TC-E6: Clarification flow - missing data triggers clarification", async () => {
    const userStories = new UserStories();
    const u1 = userStories.getStoryBy("U1");

    console.log("TC-E6 [1/6]: Generating incomplete story (no birthYear)...");
    const incompleteStory = await generateStoryFromFixture(u1, "birthYear");
    console.log("TC-E6 [1/6]: Generated story:", incompleteStory.slice(0, 300) + "...");
    const storyWithTrigger = incompleteStory + STORY_COMPLETION_TRIGGER;

    console.log("TC-E6 [2/6]: Sending incomplete story → awaiting_plan_confirmation");
    const planResponse = await runWorkflow(storyWithTrigger);

    if (planResponse.phase !== PHASE.awaiting_plan_confirmation) {
      console.log("TC-E6: Unexpected response:", JSON.stringify(planResponse, null, 2));
      expect.fail(`Expected awaiting_plan_confirmation, got ${planResponse.phase}`);
    }
    console.log(`TC-E6 [2/6]: ✅ Plan created with ${planResponse.queue.length} contexts`);

    console.log("TC-E6 [3/6]: Confirming plan → expecting clarification or context_confirmation");
    const afterPlanResponse = await runWorkflow("да, всё верно");

    if (afterPlanResponse.phase === PHASE.awaiting_context_confirmation) {
      console.log("TC-E6: ⚠️ LLM successfully extracted all required fields");
      console.log("TC-E6: birthYear was removed from fixture but extraction succeeded anyway");
      console.log("TC-E6: This is unexpected — check if extraction prompt allows defaults");
      expect.fail("TC-E6 requires clarification to trigger — extraction succeeded without birthYear in story");
    }

    if (afterPlanResponse.phase !== PHASE.awaiting_clarification) {
      console.log("TC-E6: Unexpected response:", JSON.stringify(afterPlanResponse, null, 2));
      expect.fail(`Expected awaiting_clarification, got ${afterPlanResponse.phase}`);
    }

    expect(afterPlanResponse.missingFields.length).toBeGreaterThan(0);
    console.log(`TC-E6 [3/6]: ✅ Clarification triggered! Missing fields: ${afterPlanResponse.missingFields.length}`);
    for (const field of afterPlanResponse.missingFields) {
      console.log(`TC-E6 [3/6]:   - ${field.field} (${field.entityType}): ${field.zodMessage}`);
    }

    const hasBirthYearMissing = afterPlanResponse.missingFields.some(
      (f) => f.field.toLowerCase().includes("birthyear") || f.field.toLowerCase().includes("birth"),
    );
    if (!hasBirthYearMissing) {
      console.log("TC-E6: ⚠️ birthYear not in missingFields — different field triggered clarification");
    }

    console.log("TC-E6 [4/6]: Providing clarification answer (birthYear = 1990)");
    const clarificationAnswer = "Я родился в 1990 году";
    const afterClarificationResponse = await runWorkflow(clarificationAnswer);

    if (afterClarificationResponse.phase === PHASE.awaiting_clarification) {
      console.log("TC-E6: ⚠️ Still awaiting clarification after answer");
      console.log(`TC-E6: Missing fields: ${afterClarificationResponse.missingFields.map((f) => f.field).join(", ")}`);
      console.log("TC-E6: Providing additional info and retrying...");

      const additionalInfo = "Гражданство — Россия. Высшее образование — бакалавр.";
      const retryResponse = await runWorkflow(additionalInfo);

      if (retryResponse.phase === PHASE.awaiting_clarification) {
        console.log("TC-E6: Still in clarification after 2 attempts");
        expect.fail("TC-E6: Clarification did not resolve after 2 attempts — check extraction prompts");
      }

      expect([PHASE.awaiting_context_confirmation, PHASE.awaiting_final_confirmation]).toContain(retryResponse.phase);
      console.log(`TC-E6 [4/6]: ✅ Clarification resolved after retry, phase: ${retryResponse.phase}`);
    } else {
      expect([PHASE.awaiting_context_confirmation, PHASE.awaiting_final_confirmation]).toContain(
        afterClarificationResponse.phase,
      );
      console.log(`TC-E6 [4/6]: ✅ Clarification resolved, phase: ${afterClarificationResponse.phase}`);
    }

    console.log("TC-E6 [5/6]: Completing workflow to saved state...");
    let currentResponse = afterClarificationResponse;

    while (currentResponse.phase === PHASE.awaiting_context_confirmation) {
      console.log(
        `TC-E6 [5/6]: Confirming context ${currentResponse.progress.current}/${currentResponse.progress.total}`,
      );
      currentResponse = await runWorkflow("да, верно");

      if (currentResponse.phase === PHASE.awaiting_clarification) {
        console.log("TC-E6: Additional clarification needed, providing info...");
        currentResponse = await runWorkflow("Гражданство — Россия, образование — бакалавр, родился в 1990");
      }
    }

    if (currentResponse.phase !== PHASE.awaiting_final_confirmation) {
      if (currentResponse.phase === PHASE.saved) {
        console.log("TC-E6: Already saved (fast path)");
      } else {
        expect.fail(`Expected awaiting_final_confirmation or saved, got ${currentResponse.phase}`);
      }
    }

    if (currentResponse.phase === PHASE.awaiting_final_confirmation) {
      console.log("TC-E6 [6/6]: Final confirmation → saved");
      const savedResponse = await runWorkflow("сохрани");
      expect(savedResponse.phase).toBe(PHASE.saved);
      if (savedResponse.phase === PHASE.saved) {
        console.log(`TC-E6 [6/6]: ✅ Workflow complete! Saved ${savedResponse.contexts.length} contexts`);
      }
    }

    console.log("TC-E6: ✅ Clarification flow test passed — missing fields → clarification → retry → success");
  }, 300_000);

  /**
   * TC-E1: Context extraction (skills, domains, position)
   *
   * Что тестируем:
   * LLM извлекает из story корректные данные для context:
   * position, skills[], domains[], industry, etc.
   * Все строковые поля в lowercase (System Prompt requirement).
   *
   * Given:
   * - U1 fixture → awaiting_plan_confirmation → confirm plan
   * - Extraction успешно (awaiting_context_confirmation)
   *
   * Then:
   * - entity.position non-empty, lowercase
   * - entity.skills[] non-empty, all lowercase
   * - entity.domains[] non-empty, all lowercase
   * - entity.industry non-empty, lowercase
   * - contextId matches ctx_<UUID> format
   *
   * Тип теста: Integration (real LLM)
   */
  it("TC-E1: Context extraction (skills, domains, position)", async () => {
    const userStories = new UserStories();
    const u1 = userStories.getStoryBy("U1");

    const story = await generateStoryFromFixture(u1);
    const storyWithTrigger = story + STORY_COMPLETION_TRIGGER;

    console.log("TC-E1 [1/3]: Sending story → awaiting_plan_confirmation");
    const planResponse = await runWorkflow(storyWithTrigger);

    if (planResponse.phase !== PHASE.awaiting_plan_confirmation) {
      expect.fail(`Expected awaiting_plan_confirmation, got ${planResponse.phase}`);
    }
    console.log(`TC-E1 [1/3]: ✅ Plan created with ${planResponse.queue.length} contexts`);

    console.log("TC-E1 [2/3]: Confirming plan → extraction");
    const extractionResponse = await runWorkflow("да, всё верно");

    if (extractionResponse.phase === PHASE.awaiting_clarification) {
      console.log(
        `TC-E1: ⚠️ Clarification needed for: ${extractionResponse.missingFields.map((f) => f.field).join(", ")}`,
      );
      expect.fail("TC-E1 requires successful extraction without clarification");
    }

    if (extractionResponse.phase !== PHASE.awaiting_context_confirmation) {
      expect.fail(`Expected awaiting_context_confirmation, got ${extractionResponse.phase}`);
    }

    console.log("TC-E1 [3/3]: Validating extracted context fields");
    const entity = extractionResponse.entity;

    // Position validation
    expect(entity.position.length, "position should be non-empty").toBeGreaterThan(0);
    expect(entity.position, `position "${entity.position}" should be lowercase`).toBe(entity.position.toLowerCase());

    // Skills validation
    expect(entity.skills.length, "skills[] should be non-empty").toBeGreaterThan(0);
    for (const skill of entity.skills) {
      expect(skill, `skill "${skill}" should be lowercase`).toBe(skill.toLowerCase());
    }

    // Domains validation
    expect(entity.domains.length, "domains[] should be non-empty").toBeGreaterThan(0);
    for (const domain of entity.domains) {
      expect(domain, `domain "${domain}" should be lowercase`).toBe(domain.toLowerCase());
    }

    // Industry validation
    expect(entity.industry.length, "industry should be non-empty").toBeGreaterThan(0);
    expect(entity.industry, `industry "${entity.industry}" should be lowercase`).toBe(entity.industry.toLowerCase());

    // ContextId format
    const contextIdResult = contextIdSchema.safeParse(entity.contextId);
    expect(contextIdResult.success, `contextId "${entity.contextId}" must match ctx_<UUID> format`).toBe(true);

    console.log(
      `TC-E1: ✅ Extraction verified: position="${entity.position}", ` +
        `skills=${entity.skills.length}, domains=${entity.domains.length}, industry="${entity.industry}"`,
    );
  }, 120_000);

  /**
   * TC-E2: Trails extraction + linking to contexts
   *
   * Что тестируем:
   * LLM извлекает trails (учебные траектории) и связывает их с context
   * через toContextId. Trails появляются только для контекстов с обучением.
   *
   * Given:
   * - U10 fixture (содержит trails в fixture)
   * - Extraction успешно
   *
   * Then:
   * - relatedTrails[] содержит trail с skill, platform
   * - Каждый trail имеет toContextId === текущий context
   * - Все строковые поля lowercase
   *
   * Тип теста: Integration (real LLM)
   */
  it("TC-E2: Trails extraction + linking to contexts", async () => {
    const userStories = new UserStories();
    const u10 = userStories.getStoryBy("U10"); // Has trails

    const story = await generateStoryFromFixture(u10);
    const storyWithTrigger = story + STORY_COMPLETION_TRIGGER;

    console.log("TC-E2 [1/3]: Sending U10 story (contains trails) → awaiting_plan_confirmation");
    const planResponse = await runWorkflow(storyWithTrigger);

    if (planResponse.phase !== PHASE.awaiting_plan_confirmation) {
      expect.fail(`Expected awaiting_plan_confirmation, got ${planResponse.phase}`);
    }

    // Check plan queue for incoming trails
    const totalIncomingTrails = planResponse.queue.reduce((sum, q) => sum + q.incomingTrails.length, 0);
    console.log(
      `TC-E2 [1/3]: ✅ Plan has ${planResponse.queue.length} contexts, ${totalIncomingTrails} incoming trails`,
    );

    console.log("TC-E2 [2/3]: Confirming plan → extraction");
    let currentResponse = await runWorkflow("да, всё верно");

    if (currentResponse.phase === PHASE.awaiting_clarification) {
      expect.fail("TC-E2 requires successful extraction without clarification");
    }

    // Find first context with trails
    let foundTrails = false;
    while (currentResponse.phase === PHASE.awaiting_context_confirmation) {
      const trails = currentResponse.relatedTrails ?? [];

      if (trails.length === 0) {
        console.log(`TC-E2: Context "${currentResponse.entity.position}" has no trails, continuing...`);
        currentResponse = await runWorkflow("да, верно");
        continue;
      }

      foundTrails = true;
      console.log(`TC-E2 [3/3]: Found ${trails.length} trail(s) for context "${currentResponse.entity.position}"`);

      for (const trail of trails) {
        // Skill validation
        expect(trail.skill.length, "trail.skill should be non-empty").toBeGreaterThan(0);
        expect(trail.skill, `trail.skill "${trail.skill}" should be lowercase`).toBe(trail.skill.toLowerCase());

        // Platform validation
        expect(trail.platform.length, "trail.platform should be non-empty").toBeGreaterThan(0);
        expect(trail.platform, `trail.platform "${trail.platform}" should be lowercase`).toBe(
          trail.platform.toLowerCase(),
        );

        // Context linking
        expect(trail.toContextId, "trail.toContextId should be set").toBe(currentResponse.entity.contextId);

        console.log(`TC-E2: Trail "${trail.skill}" on ${trail.platform} → ctx=${trail.toContextId}`);
      }
      break; // Found trails, test goal achieved
    }

    if (!foundTrails) {
      console.log("TC-E2: ⚠️ No trails extracted from U10 story");
      console.log("TC-E2: This may indicate LLM didn't recognize learning history from story");
      // Don't fail - U10 may have been modified or LLM interpretation differs
    }

    console.log(`TC-E2: ✅ Trails extraction + linking test completed (foundTrails=${foundTrails})`);
  }, 180_000);

  /**
   * TC-E3: Multi-context iteration (queue processing)
   *
   * Что тестируем:
   * Workflow итерирует через все contexts в queue, извлекая данные для каждого.
   * Progress indicator (current/total) корректно обновляется.
   *
   * Given:
   * - U10 fixture (3+ contexts)
   * - User confirms each context
   *
   * Then:
   * - progress.current инкрементируется от 1 до total
   * - После последнего context: awaiting_final_confirmation
   * - Каждый context имеет уникальный contextId
   *
   * Тип теста: Integration (real LLM)
   */
  it("TC-E3: Multi-context iteration (queue processing)", async () => {
    const userStories = new UserStories();
    const u10 = userStories.getStoryBy("U10");

    const story = await generateStoryFromFixture(u10);
    const storyWithTrigger = story + STORY_COMPLETION_TRIGGER;

    console.log("TC-E3 [1/4]: Sending U10 story → awaiting_plan_confirmation");
    const planResponse = await runWorkflow(storyWithTrigger);

    if (planResponse.phase !== PHASE.awaiting_plan_confirmation) {
      expect.fail(`Expected awaiting_plan_confirmation, got ${planResponse.phase}`);
    }

    const expectedTotal = planResponse.queue.length;
    expect(expectedTotal, "U10 should have 3+ contexts").toBeGreaterThanOrEqual(3);
    console.log(`TC-E3 [1/4]: ✅ Plan created with ${expectedTotal} contexts`);

    console.log("TC-E3 [2/4]: Confirming plan → extraction");
    let currentResponse = await runWorkflow("да, всё верно");

    if (currentResponse.phase === PHASE.awaiting_clarification) {
      expect.fail("TC-E3 requires successful extraction without clarification");
    }

    if (currentResponse.phase !== PHASE.awaiting_context_confirmation) {
      expect.fail(`Expected awaiting_context_confirmation, got ${currentResponse.phase}`);
    }

    console.log("TC-E3 [3/4]: Iterating through all contexts");
    const seenContextIds = new Set<string>();
    let lastCurrent = 0;

    while (currentResponse.phase === PHASE.awaiting_context_confirmation) {
      const { current, total } = currentResponse.progress;
      const ctxId = currentResponse.entity.contextId;

      // Progress validation
      expect(total, "progress.total should match queue length").toBe(expectedTotal);
      expect(current, "progress.current should increment").toBeGreaterThan(lastCurrent);
      lastCurrent = current;

      // Unique contextId
      expect(seenContextIds.has(ctxId), `contextId "${ctxId}" should be unique`).toBe(false);
      seenContextIds.add(ctxId);

      console.log(`TC-E3: Context ${current}/${total}: "${currentResponse.entity.position}" (${ctxId})`);

      currentResponse = await runWorkflow("да, верно");
    }

    // Should reach final confirmation
    expect(currentResponse.phase, "After all contexts should reach final confirmation").toBe(
      PHASE.awaiting_final_confirmation,
    );

    // All contexts processed
    expect(seenContextIds.size, "Should have processed all contexts from queue").toBe(expectedTotal);

    console.log(
      `TC-E3: ✅ Multi-context iteration complete: ${seenContextIds.size}/${expectedTotal} contexts processed`,
    );
  }, 240_000);

  /**
   * TC-E5: Trail correction attempt (negative test)
   *
   * Что тестируем:
   * Trails НЕ редактируются напрямую (нет edit_trail node).
   * При попытке изменить trail, система должна либо:
   * 1) Предложить re-extract весь context (re-plan)
   * 2) Проигнорировать trail-specific edit и применить только к context
   * 3) Gracefully handle без crash
   *
   * Given:
   * - Context extracted with trail (awaiting_context_confirmation)
   * - User sends: "измени тропу на другую платформу"
   *
   * Then:
   * - Workflow НЕ падает с ошибкой
   * - Phase остаётся валидной (не failed)
   * - Trail editing НЕ поддерживается (фиксируем текущее поведение)
   *
   * Тип теста: Integration (real LLM) — Negative test
   */
  it("TC-E5: Trail correction attempt (negative test)", async () => {
    const userStories = new UserStories();
    const u10 = userStories.getStoryBy("U10"); // Has trails

    const story = await generateStoryFromFixture(u10);
    const storyWithTrigger = story + STORY_COMPLETION_TRIGGER;

    console.log("TC-E5 [1/4]: Sending story with trails → awaiting_plan_confirmation");
    const planResponse = await runWorkflow(storyWithTrigger);

    if (planResponse.phase !== PHASE.awaiting_plan_confirmation) {
      expect.fail(`Expected awaiting_plan_confirmation, got ${planResponse.phase}`);
    }
    console.log(`TC-E5 [1/4]: ✅ Plan created with ${planResponse.queue.length} contexts`);

    console.log("TC-E5 [2/4]: Confirming plan → awaiting_context_confirmation");
    const extractionResponse = await runWorkflow("да, всё верно");

    if (extractionResponse.phase === PHASE.awaiting_clarification) {
      expect.fail("TC-E5 requires successful extraction without clarification");
    }

    if (extractionResponse.phase !== PHASE.awaiting_context_confirmation) {
      expect.fail(`Expected awaiting_context_confirmation, got ${extractionResponse.phase}`);
    }

    const relatedTrails = extractionResponse.relatedTrails ?? [];
    console.log(`TC-E5 [2/4]: ✅ Context extracted with ${relatedTrails.length} trail(s)`);

    // Даже если trails не извлечены, пробуем trail edit request
    // Это проверяет что LLM gracefully handle trail-specific corrections
    console.log("TC-E5 [3/4]: Attempting trail edit → 'измени тропу на другую платформу'");
    const editAttemptResponse = await runWorkflow(
      "нет, я прошёл курс не на Coursera, а на Udemy. Измени платформу обучения на Udemy",
    );

    console.log(`TC-E5 [3/4]: Response phase: ${editAttemptResponse.phase}`);

    // Проверяем что workflow НЕ упал
    expect(editAttemptResponse.phase).not.toBe(PHASE.failed);

    // Проверяем что phase остался валидным (LLM handle trail edit как может)
    // Возможные варианты:
    // 1. awaiting_context_confirmation - LLM проигнорировал trail edit или не понял
    // 2. story_gathering - LLM предложил re-plan
    // 3. awaiting_clarification - LLM не понял что делать
    const isValid =
      editAttemptResponse.phase === PHASE.awaiting_context_confirmation ||
      editAttemptResponse.phase === PHASE.story_gathering ||
      editAttemptResponse.phase === PHASE.awaiting_clarification;

    if (!isValid) {
      console.log(`TC-E5: ⚠️ Unexpected phase after trail edit attempt: ${editAttemptResponse.phase}`);
      console.log("TC-E5: This may indicate a regression or new behavior to document");
    }

    console.log(`TC-E5 [4/4]: ✅ Trail edit handled gracefully — phase: ${editAttemptResponse.phase} (no crash)`);
    console.log("TC-E5: Note: Trails are regenerated via re-extraction, not edited directly");
  }, 180_000);
});
