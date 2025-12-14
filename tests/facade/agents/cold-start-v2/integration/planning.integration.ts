import { beforeEach, describe, expect, it } from "vitest";

import { ColdStartGraph, PHASE } from "../../../../../src/facade/langGraph/cold-start-v2/cold-start-graph.js";
import { contextIdSchema } from "../../../../../src/shared/schemas.js";
import { FacadeTestContext } from "../../../helpers/test-context.js";
import { UserStories } from "../../../../core/helpers/user-stories.js";

import { generateStoryFromFixture } from "../../cold-start/helpers/cold-start-helpers.js";

import type { UserId } from "../../../../../src/shared/schemas.js";

const STORY_COMPLETION_TRIGGER = "\n\nГотово, это вся моя карьерная история.";

describe("Cold-Start V2: Planning (TC-P)", () => {
  const testUserId: UserId = "usr_01933ec5-0001-0000-0000-000000000001";
  const threadId = `cold_start_v2_${testUserId}`;

  const runWorkflow = (message: string): ReturnType<ColdStartGraph["run"]> => {
    const ctx = FacadeTestContext.getInstance();
    return new ColdStartGraph(ctx.getGraphDeps()).run(message, threadId, testUserId);
  };

  beforeEach(async () => {
    const ctx = FacadeTestContext.getInstance();
    await ctx.checkpointService.delete(threadId);
  });

  /**
   * TC-P1: Story → Plan creation
   *
   * Что тестируем:
   * LLM анализирует полную карьерную историю с explicit trigger и создаёт план.
   * После U1 fixture (полная история) + trigger "Готово, это вся моя карьерная история."
   * граф ДОЛЖЕН перейти в awaiting_plan_confirmation.
   *
   * Given:
   * - Story: U1 fixture (unpacked LLM-generated text, полная история с 2+ позициями)
   * - Trigger: "Готово, это вся моя карьерная история."
   *
   * Then:
   * - Phase: awaiting_plan_confirmation (STRICT)
   * - Queue содержит контексты с preview и contextId
   *
   * Note: Если тест падает, проверить:
   * 1. STORY_DECISION_PROMPT regression (trigger detection)
   * 2. LLM model change
   *
   * Тип теста: Integration (real LLM)
   */
  it("TC-P1: Story → Plan creation", async () => {
    const userStories = new UserStories();
    const u1 = userStories.getStoryBy("U1");

    const story = await generateStoryFromFixture(u1);
    const storyWithTrigger = story + STORY_COMPLETION_TRIGGER;

    const response = await runWorkflow(storyWithTrigger);

    // СТРОГАЯ ПРОВЕРКА: full story + explicit trigger MUST proceed to planning
    expect(
      response.phase,
      "Full career story + explicit trigger MUST proceed to planning. " +
        "If this fails, check: (1) STORY_DECISION_PROMPT regression, (2) LLM model change",
    ).toBe("awaiting_plan_confirmation");

    // Type guard для доступа к phase-specific properties
    if (response.phase !== "awaiting_plan_confirmation") {
      expect.fail("Type guard failed after strict assertion");
    }

    expect(response.queue.length, "Plan must contain at least 1 context").toBeGreaterThan(0);

    const firstContext = response.queue[0]!;
    expect(firstContext.preview.length, "Context preview must be non-empty").toBeGreaterThan(0);

    const contextIdResult = contextIdSchema.safeParse(firstContext.contextId);
    expect(contextIdResult.success, `contextId must match ctx_<UUID> format`).toBe(true);

    console.log(`TC-P1: ✅ Plan created with ${response.queue.length} context(s)`);
  }, 120_000);

  /**
   * TC-P2: No experience → clarification request
   *
   * Что тестируем:
   * Если пользователь сообщает историю без карьерного опыта (студент, никогда не работал),
   * LLM ДОЛЖЕН запросить уточнение, так как нечего планировать.
   *
   * Эмпирика: 100% стабильность (3/3 runs → story_gathering).
   *
   * Given:
   * - Story: "Я студент, никогда не работал, нет опыта" (explicit no experience)
   * - Story содержит противоречие: "не работал" + "репетитор пару раз"
   * - Trigger: completion marker
   *
   * Then:
   * - Phase: story_gathering (STRICT)
   * - LLM запрашивает больше информации или уточнение
   *
   * Note: Если тест падает (LLM создает plan из пустоты):
   * 1. Проверить STORY_DECISION_PROMPT (INSUFFICIENT DETAIL rule)
   * 2. Проверить fixture (возможно LLM интерпретирует "репетитор" как career)
   *
   * Тип теста: Integration (real LLM)
   */
  it("TC-P2: No experience → clarification request", async () => {
    const noExperienceStory = `
      Привет! Я студент третьего курса университета.
      Изучаю экономику. Никогда нигде не работал.
      Никакого профессионального опыта у меня нет. Вообще.

      ${STORY_COMPLETION_TRIGGER}
    `;

    const response = await runWorkflow(noExperienceStory);

    // СТРОГАЯ ПРОВЕРКА: no experience MUST ask for clarification (better UX than immediate fail)
    expect(
      response.phase,
      "No experience scenario MUST ask for clarification (better UX than immediate fail or creating plan from nothing). " +
        "If this fails, check: (1) STORY_DECISION_PROMPT INSUFFICIENT DETAIL rule, (2) fixture interpretation",
    ).toBe(PHASE.story_gathering);

    // Type guard для доступа к phase-specific properties
    if (response.phase !== PHASE.story_gathering) {
      expect.fail("Type guard failed after strict assertion");
    }

    expect(response.message.length, "LLM should explain why more info is needed").toBeGreaterThan(0);

    console.log(`TC-P2: ✅ LLM asked for clarification (correct behavior for no experience)`);
  }, 120_000);

  /**
   * TC-P4: Plan rejection → back to story gathering
   *
   * Что тестируем:
   * Пользователь может отклонить план и вернуться к редактированию истории.
   * LLM парсит "edit" intent и граф возвращается в story_gathering.
   *
   * Bug fix context:
   * CONFIRMATION_PROMPT теперь приоритизирует edit intent для "нет + заново/переделай".
   * Раньше "нет" парсилось как cancel → phase: failed.
   *
   * Given:
   * - Story → awaiting_plan_confirmation
   * - User rejects: "давай заново, это неправильно" (explicit edit intent)
   *
   * Then:
   * - Phase: story_gathering
   * - Message предлагает дополнить историю
   *
   * Тип теста: Integration (real LLM)
   */
  it("TC-P4: Plan rejection → back to story gathering", async () => {
    const userStories = new UserStories();
    const u1 = userStories.getStoryBy("U1");

    const story = await generateStoryFromFixture(u1);
    const storyWithTrigger = story + STORY_COMPLETION_TRIGGER;

    const planResponse = await runWorkflow(storyWithTrigger);

    if (planResponse.phase !== PHASE.awaiting_plan_confirmation) {
      expect.fail(`Expected awaiting_plan_confirmation, got ${planResponse.phase}`);
    }

    console.log(`TC-P4 step 1: plan created with ${planResponse.queue.length} contexts`);

    const rejectResponse = await runWorkflow("давай заново, это неправильно");

    expect(rejectResponse.phase).toBe(PHASE.story_gathering);

    if (rejectResponse.phase !== PHASE.story_gathering) {
      expect.fail(`Expected story_gathering, got ${rejectResponse.phase}`);
    }

    expect(rejectResponse.message.length).toBeGreaterThan(0);
    console.log(`TC-P4 result: returned to story gathering`);
  }, 180_000);

  /**
   * TC-P3: Plan confirmation → extraction start
   *
   * Что тестируем:
   * После подтверждения плана пользователем граф переходит к extraction
   * первого контекста. LLM извлекает детали (position, skills, domains).
   *
   * Given:
   * - Story → awaiting_plan_confirmation
   * - User confirms: "да, всё верно"
   *
   * Then:
   * - Phase: awaiting_context_confirmation OR awaiting_clarification
   * - При context_confirmation: entity с position, progress (current/total)
   * - При clarification: missingFields > 0
   *
   * Тип теста: Integration (real LLM)
   */
  it("TC-P3: Plan confirmation → extraction start", async () => {
    const userStories = new UserStories();
    const u1 = userStories.getStoryBy("U1");

    const story = await generateStoryFromFixture(u1);
    const storyWithTrigger = story + STORY_COMPLETION_TRIGGER;

    const planResponse = await runWorkflow(storyWithTrigger);

    if (planResponse.phase !== PHASE.awaiting_plan_confirmation) {
      expect.fail(`Expected awaiting_plan_confirmation, got ${planResponse.phase}`);
    }

    console.log(`TC-P3 step 1: plan created with ${planResponse.queue.length} contexts`);

    const confirmResponse = await runWorkflow("да, всё верно");

    if (confirmResponse.phase === PHASE.awaiting_context_confirmation) {
      expect(confirmResponse.entity.position.length, "position should be non-empty").toBeGreaterThan(0);
      expect(confirmResponse.entity.position, "position should be lowercase").toBe(
        confirmResponse.entity.position.toLowerCase(),
      );
      const entityContextIdResult = contextIdSchema.safeParse(confirmResponse.entity.contextId);
      expect(
        entityContextIdResult.success,
        `entity.contextId "${confirmResponse.entity.contextId}" must match ctx_<UUID> format`,
      ).toBe(true);
      expect(confirmResponse.progress.current, "progress.current should be 1 for first context").toBe(1);
      expect(confirmResponse.progress.total, "progress.total should match queue length").toBe(
        planResponse.queue.length,
      );

      console.log(
        `TC-P3 result: extracted "${confirmResponse.entity.position}" (${confirmResponse.progress.current}/${confirmResponse.progress.total})`,
      );
    } else if (confirmResponse.phase === PHASE.awaiting_clarification) {
      expect(confirmResponse.missingFields.length, "clarification should have missingFields > 0").toBeGreaterThan(0);

      for (const field of confirmResponse.missingFields) {
        expect(field.field.length, "missingField.field should be non-empty").toBeGreaterThan(0);
        expect(field.entityType, "missingField.entityType should be context or trail").toMatch(/^(context|trail)$/);
      }

      console.log(
        `TC-P3 result: clarification needed for ${confirmResponse.missingFields.length} field(s): ${confirmResponse.missingFields.map((f) => f.field).join(", ")}`,
      );
    } else {
      expect.fail(`Expected extraction phase, got ${confirmResponse.phase}`);
    }
  }, 180_000);
});
