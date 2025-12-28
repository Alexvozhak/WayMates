import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

import { ColdStartGraph, PHASE } from "../../../../../src/facade/langGraph/cold-start-v2/cold-start-graph.js";
import { contextIdSchema } from "../../../../../src/shared/schemas.js";
import { FacadeTestContext } from "../../../helpers/test-context.js";

import type { UserId } from "../../../../../src/shared/schemas.js";

const FIXTURES_DIR = path.join(import.meta.dirname, "../../../../fixtures");
const CV_FIXTURE = fs.readFileSync(path.join(FIXTURES_DIR, "test-cv-anonymized.md"), "utf8");

const STORY_COMPLETION_TRIGGER = "\n\nГотово, это вся моя карьерная история.";

describe("Cold-Start V2: CV Upload (TC-P5..P12)", () => {
  const testUserId: UserId = "usr_01933ec5-0002-0000-0000-000000000001";
  const threadId = `cold_start_v2_cv_${testUserId}`;

  const runWorkflow = (message: string, cvText: string | null = null): ReturnType<ColdStartGraph["run"]> => {
    const ctx = FacadeTestContext.getInstance();
    return new ColdStartGraph(ctx.getGraphDeps()).run(message, threadId, testUserId, cvText, "en");
  };

  beforeEach(async () => {
    const ctx = FacadeTestContext.getInstance();
    await ctx.checkpointService.delete(threadId);
  });

  /**
   * TC-P5: Plan creation from CV only (no conversation history)
   *
   * Что тестируем:
   * LLM создаёт план исключительно на основе cvText без предшествующей conversation.
   * Это сценарий "быстрый старт с резюме" - пользователь сразу загрузил PDF.
   *
   * Бизнес-правило:
   * Если cvText содержит 4 позиции (Junior → Software → Full Stack → Senior),
   * план ДОЛЖЕН содержать минимум 3 позиции (LLM может объединить похожие).
   *
   * Given:
   * - Message: minimal trigger "Вот моё резюме"
   * - cvText: test-cv-anonymized.md (4 позиции: 2016-2017, 2017-2019, 2019-2020, 2021-present)
   *
   * Then:
   * - Phase: awaiting_plan_confirmation
   * - Queue: >= 3 contexts (LLM extracts career positions from CV)
   * - Each context has valid contextId
   *
   * Тип теста: Integration (real LLM)
   */
  it("TC-P5: Plan creation from CV only", async () => {
    const response = await runWorkflow("Вот моё резюме, построй план" + STORY_COMPLETION_TRIGGER, CV_FIXTURE);

    expect(
      response.phase,
      "CV with 4 positions MUST produce plan. If fails: check planningPrompt cvText handling",
    ).toBe(PHASE.awaiting_plan_confirmation);

    if (response.phase !== PHASE.awaiting_plan_confirmation) {
      expect.fail("Type guard failed");
    }

    expect(
      response.queue.length,
      "CV has 4 positions (Junior 2016, SWE 2017, Full Stack 2019, Senior 2021). " +
        "Plan should have >= 3 contexts (LLM may merge similar positions)",
    ).toBeGreaterThanOrEqual(3);

    for (const ctx of response.queue) {
      const result = contextIdSchema.safeParse(ctx.contextId);
      expect(result.success, `contextId "${ctx.contextId}" must be valid UUID`).toBe(true);
      expect(ctx.preview.length, "Each context must have preview").toBeGreaterThan(0);
    }

    console.log(`TC-P5: ✅ Plan from CV only: ${response.queue.length} contexts`);
    console.log(`       Positions: ${response.queue.map((c) => c.preview).join(" → ")}`);
  }, 120_000);

  /**
   * TC-P6: CV + conversation merge
   *
   * Что тестируем:
   * LLM объединяет информацию из cvText И conversation.
   * Conversation добавляет позицию, которой НЕТ в CV.
   *
   * Бизнес-правило:
   * Финальный план должен содержать позиции из ОБОИХ источников.
   * CV: 4 позиции (2016-2021+)
   * Conversation: +1 позиция (фриланс 2015)
   * Total: >= 4 позиций
   *
   * Given:
   * - Message: история с дополнительной позицией (freelance 2015)
   * - cvText: test-cv-anonymized.md
   *
   * Then:
   * - Phase: awaiting_plan_confirmation
   * - Queue: >= 4 contexts (CV positions + freelance from conversation)
   *
   * Тип теста: Integration (real LLM)
   */
  it("TC-P6: CV + conversation merge", async () => {
    const conversationWithExtra = `
      До первой официальной работы я полгода фрилансил - делал сайты на WordPress
      для местных бизнесов в 2015 году. Это было до того, что указано в резюме.
      Вот моё резюме с официальными позициями.
      ${STORY_COMPLETION_TRIGGER}
    `;

    const response = await runWorkflow(conversationWithExtra, CV_FIXTURE);

    expect(response.phase, "CV + conversation MUST produce plan. If fails: check prompt merge logic").toBe(
      PHASE.awaiting_plan_confirmation,
    );

    if (response.phase !== PHASE.awaiting_plan_confirmation) {
      expect.fail("Type guard failed");
    }

    expect(
      response.queue.length,
      "CV (4 positions) + conversation (freelance 2015) should produce >= 4 contexts. " +
        "LLM should merge BOTH sources, not ignore conversation",
    ).toBeGreaterThanOrEqual(4);

    console.log(`TC-P6: ✅ CV + conversation merged: ${response.queue.length} contexts`);
  }, 120_000);

  /**
   * TC-P7: Conflict resolution - conversation wins
   *
   * Что тестируем:
   * При конфликте между cvText и conversation, conversation имеет приоритет.
   * Это критичное бизнес-правило: пользователь ЯВНО уточняет/исправляет данные.
   *
   * Бизнес-правило:
   * CV говорит "Senior Software Engineer 2021-present"
   * Conversation говорит "На самом деле я уже год как Product Manager, не разработчик"
   * План ДОЛЖЕН отражать PM, а не SWE для последней позиции.
   *
   * Given:
   * - Message: явное исправление текущей позиции (SWE → PM)
   * - cvText: test-cv-anonymized.md (Senior SWE 2021-present)
   *
   * Then:
   * - Phase: awaiting_plan_confirmation
   * - Последняя позиция в queue содержит "product" или "pm" (case-insensitive)
   *
   * Тип теста: Integration (real LLM)
   */
  it("TC-P7: Conflict resolution - conversation wins", async () => {
    const conflictingConversation = `
      В резюме написано что я Senior Software Engineer, но это устаревшая информация.
      На самом деле с начала 2024 года я перешёл на позицию Product Manager в той же компании.
      Так что последняя позиция - это PM, а не разработчик.
      Вот резюме, но учти мою поправку про текущую роль.
      ${STORY_COMPLETION_TRIGGER}
    `;

    const response = await runWorkflow(conflictingConversation, CV_FIXTURE);

    expect(response.phase, "Conflict scenario MUST produce plan. If fails: check prompt priority rules").toBe(
      PHASE.awaiting_plan_confirmation,
    );

    if (response.phase !== PHASE.awaiting_plan_confirmation) {
      expect.fail("Type guard failed");
    }

    expect(response.queue.length).toBeGreaterThan(0);

    const lastPosition = response.queue.at(-1)!;
    const previewLower = lastPosition.preview.toLowerCase();

    expect(
      previewLower.includes("product") || previewLower.includes("pm") || previewLower.includes("manager"),
      `Last position should be PM (from conversation), not SWE (from CV). ` +
        `Got: "${lastPosition.preview}". ` +
        `If fails: planningPrompt does not prioritize conversation over CV`,
    ).toBe(true);

    console.log(`TC-P7: ✅ Conflict resolved: last position = "${lastPosition.preview}"`);
  }, 120_000);

  /**
   * TC-P8: Minimal CV (single position)
   *
   * Что тестируем:
   * LLM корректно обрабатывает минимальное CV с одной позицией.
   * Edge case: не все резюме содержат богатую историю.
   *
   * Бизнес-правило:
   * Даже с 1 позицией система должна создать план.
   *
   * Given:
   * - Message: minimal trigger
   * - cvText: inline minimal CV (1 position only)
   *
   * Then:
   * - Phase: awaiting_plan_confirmation
   * - Queue: >= 1 context
   *
   * Тип теста: Integration (real LLM)
   */
  it("TC-P8: Minimal CV (single position)", async () => {
    const minimalCv = `
## Junior Developer (2023 - Present)
Industry: Startup, Company Size: 5-10, Location: Moscow, Russia

- Learning web development
- Building simple web applications
- Technologies: JavaScript, React, Node.js
`;

    const response = await runWorkflow(
      "Вот моё первое резюме, только начинаю карьеру" + STORY_COMPLETION_TRIGGER,
      minimalCv,
    );

    expect(response.phase, "Single-position CV MUST produce plan. If fails: check empty/minimal CV handling").toBe(
      PHASE.awaiting_plan_confirmation,
    );

    if (response.phase !== PHASE.awaiting_plan_confirmation) {
      expect.fail("Type guard failed");
    }

    expect(response.queue.length, "Single position CV should produce at least 1 context").toBeGreaterThanOrEqual(1);

    console.log(`TC-P8: ✅ Minimal CV handled: ${response.queue.length} context(s)`);
  }, 120_000);

  /**
   * TC-P9: Empty cvText graceful fallback
   *
   * Что тестируем:
   * Система корректно обрабатывает пустую строку вместо CV.
   * Edge case: где-то в коде передали "" вместо undefined.
   *
   * Бизнес-правило:
   * Пустой cvText ("") должен вести себя как undefined — fallback на conversation.
   * Если conversation содержит позицию, план должен быть создан.
   *
   * Given:
   * - Message: conversation с одной позицией
   * - cvText: "" (пустая строка)
   *
   * Then:
   * - Phase: awaiting_plan_confirmation
   * - Queue: >= 1 context (из conversation)
   *
   * Тип теста: Integration (real LLM)
   */
  it("TC-P9: Empty cvText graceful fallback", async () => {
    const response = await runWorkflow(
      "Я работаю Junior Python Developer в Яндексе с 2023 года" + STORY_COMPLETION_TRIGGER,
      "", // Empty string instead of undefined
    );

    expect(
      response.phase,
      "Empty cvText MUST fallback to conversation. If fails: check parseStoryCompletion empty string handling",
    ).toBe(PHASE.awaiting_plan_confirmation);

    if (response.phase !== PHASE.awaiting_plan_confirmation) {
      expect.fail("Type guard failed");
    }

    expect(
      response.queue.length,
      "Conversation has 1 position — plan should be created despite empty cvText",
    ).toBeGreaterThanOrEqual(1);

    console.log(`TC-P9: ✅ Empty cvText handled: ${response.queue.length} context(s)`);
  }, 120_000);

  /**
   * TC-P10: Malformed CV graceful fallback
   *
   * Что тестируем:
   * Система корректно обрабатывает "мусор" вместо валидного CV.
   * Edge case: Gemini не смог распарсить PDF и вернул garbage.
   *
   * Бизнес-правило:
   * Если cvText содержит нераспознаваемый контент, LLM должен:
   * 1. Игнорировать мусор
   * 2. Использовать conversation для построения плана
   *
   * Given:
   * - Message: conversation с позицией
   * - cvText: binary-like garbage (имитация неудачного парсинга PDF)
   *
   * Then:
   * - Phase: awaiting_plan_confirmation
   * - Queue: >= 1 context (из conversation, не из garbage)
   *
   * Тип теста: Integration (real LLM)
   */
  it("TC-P10: Malformed CV graceful fallback", async () => {
    const malformedCv = `%PDF-1.4
%%EOF
\u0000\u0001\u0002\u0003 binary garbage here
Some random text that doesn't look like a CV
!@#$%^&*()_+`;

    const response = await runWorkflow(
      "Я Senior Backend Developer, работаю в Google с 2020 года на Go и Kubernetes" + STORY_COMPLETION_TRIGGER,
      malformedCv,
    );

    expect(
      response.phase,
      "Malformed CV MUST be ignored, conversation should work. " + "If fails: LLM confused by garbage in cvText",
    ).toBe(PHASE.awaiting_plan_confirmation);

    if (response.phase !== PHASE.awaiting_plan_confirmation) {
      expect.fail("Type guard failed");
    }

    expect(
      response.queue.length,
      "Plan should be created from conversation despite garbage cvText",
    ).toBeGreaterThanOrEqual(1);

    const hasGooglePosition = response.queue.some(
      (ctx) => ctx.preview.toLowerCase().includes("google") || ctx.preview.toLowerCase().includes("backend"),
    );
    expect(
      hasGooglePosition,
      "Plan should contain Google/Backend position from conversation, not garbage from cvText",
    ).toBe(true);

    console.log(`TC-P10: ✅ Malformed CV ignored: ${response.queue.length} context(s)`);
  }, 120_000);

  /**
   * TC-P12: Non-English CV (Russian)
   *
   * Что тестируем:
   * Система корректно обрабатывает CV на русском языке.
   * Мультиязычная аудитория — критично для продукта.
   *
   * Бизнес-правило:
   * CV на любом языке должен быть распознан и преобразован в план.
   * Preview может быть на любом языке, но должен содержать год.
   *
   * Given:
   * - Message: русский текст
   * - cvText: CV полностью на русском
   *
   * Then:
   * - Phase: awaiting_plan_confirmation
   * - Queue: >= 2 contexts
   * - Each preview contains year (YYYY format)
   *
   * Тип теста: Integration (real LLM)
   */
  it("TC-P12: Non-English CV (Russian)", async () => {
    const russianCv = `
# Профессиональный профиль
Старший разработчик | 5+ лет опыта

## Опыт работы

## Старший разработчик (2022 - настоящее время)
Индустрия: Финтех, Размер компании: 100-500, Локация: Москва, Россия

- Разработка микросервисной архитектуры
- Технологии: Python, FastAPI, PostgreSQL, Redis, Kubernetes

## Разработчик (2019 - 2022)
Индустрия: E-commerce, Размер компании: 50-100, Локация: Санкт-Петербург, Россия

- Разработка backend для маркетплейса
- Технологии: Python, Django, MySQL, Docker
`;

    const response = await runWorkflow("Вот моё резюме на русском языке" + STORY_COMPLETION_TRIGGER, russianCv);

    expect(response.phase, "Russian CV MUST produce plan. If fails: LLM has issues with non-English content").toBe(
      PHASE.awaiting_plan_confirmation,
    );

    if (response.phase !== PHASE.awaiting_plan_confirmation) {
      expect.fail("Type guard failed");
    }

    expect(response.queue.length, "Russian CV with 2 positions should produce >= 2 contexts").toBeGreaterThanOrEqual(2);

    // Preview должен содержать год независимо от языка
    for (const ctx of response.queue) {
      expect(/\d{4}/.test(ctx.preview), `Preview should contain year (YYYY). Got: "${ctx.preview}"`).toBe(true);
    }

    console.log(`TC-P12: ✅ Russian CV handled: ${response.queue.length} contexts`);
    console.log(`        Positions: ${response.queue.map((c) => c.preview).join(" → ")}`);
  }, 120_000);
});
