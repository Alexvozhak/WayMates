import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";

import { postgresService } from "../../../../../src/facade/infrastructure/postgres.service.js";
import { ColdStartWorkflow } from "../../../../../src/facade/langchain/cold-start/cold-start-agent.js";
import { PHASE } from "../../../../../src/facade/langchain/cold-start/types.js";
import { UserStories } from "../../../../core/helpers/user-stories.js";

import { generateStoryFromFixture } from "../helpers/cold-start-helpers.js";

import type { UserId } from "../../../../../src/shared/schemas.js";

// Триггер для перехода story_gathering → plan_career_history.
// Без этого agent будет просить продолжить рассказ (см. SYSTEM_PROMPT Phase 1).
const STORY_COMPLETION_TRIGGER = "\n\nГотово, это вся моя карьерная история.";

describe("Cold-Start Smoke Tests (P0)", () => {
  const testUserId: UserId = "usr_01933ec5-0001-0000-0000-000000000001";
  const threadId = `cold_start_${testUserId}`;

  const runWorkflow = (message: string) => new ColdStartWorkflow(testUserId).run(message, threadId);

  beforeAll(async () => {
    await postgresService.initialize();
  });

  beforeEach(async () => {
    await postgresService.deleteCheckpoint(threadId);
  });

  afterAll(async () => {
    await postgresService.close();
  });

  // T01: Agent workflow живой
  it("T01: Agent workflow responds (LangChain v1 config check)", async () => {
    // Business rule: Agent должен отвечать story_gathering при холодном старте.
    // Проверяет что LangChain v1 + PostgresSaver + Gemini model настроены корректно.

    const message = "Hello";

    const response = await runWorkflow(message);

    // Business assertion: Phase должна быть story_gathering (начальная фаза)
    expect(response.phase).toBe("story_gathering");
  });

  // T02: Story → valid response structure per phase
  it("T02: Story produces valid discriminated response", async () => {
    // Business rule: Agent обрабатывает историю и возвращает корректный
    // discriminated union response.
    //
    // Ожидаемый исход: awaiting_plan_confirmation (LLM распознал историю → queue)
    // Fallback: story_gathering (LLM решил что история недостаточная)
    //
    // НЕ проверяем: exact extraction (LLM вариативен), Zod validation (гарантировано типами)

    const userStories = new UserStories();
    const u1 = userStories.getStoryBy("U1");

    const story = await generateStoryFromFixture(u1);
    const storyWithTrigger = story + STORY_COMPLETION_TRIGGER;

    const response = await runWorkflow(storyWithTrigger);

    // Business assertions per phase (discriminated union)
    if (response.phase === "story_gathering") {
      // Fallback: LLM решил что история недостаточная несмотря на "готово"
      expect(response.message.length).toBeGreaterThan(0);
    } else if (response.phase === "awaiting_plan_confirmation") {
      // LLM распознал историю → queue с контекстами
      expect(response.queue.length).toBeGreaterThan(0);

      const firstContext = response.queue[0]!;
      // U1 имеет 2 контекста — минимум 1 должен быть распознан
      expect(firstContext.preview.length).toBeGreaterThan(0);
      // contextId генерируется upfront (UUID v7 format)
      expect(firstContext.contextId).toMatch(/^ctx_[\da-f-]{36}$/);
    } else {
      // Неожиданная фаза → явный fail с диагностикой
      expect.fail(`Unexpected phase after story: ${response.phase}`);
    }

    console.log(
      `T02 result: phase=${response.phase}, queue=${response.phase === "awaiting_plan_confirmation" ? response.queue.length : "N/A"}`,
    );
  }, 120_000);

  // T02.5: Plan confirmation → extraction (smoke extension of T02)
  it("T02.5: Plan confirmation triggers extraction", async () => {
    // Business rule: После подтверждения плана agent извлекает первый контекст.
    // Проверяет interrupt-resume flow + process_entity_batch + ToolMessage.

    const userStories = new UserStories();
    const u1 = userStories.getStoryBy("U1");

    // Step 1: История → awaiting_plan_confirmation
    const story = await generateStoryFromFixture(u1);
    const storyWithTrigger = story + STORY_COMPLETION_TRIGGER;

    const planResponse = await runWorkflow(storyWithTrigger);

    if (planResponse.phase !== PHASE.awaiting_plan_confirmation) {
      expect.fail(`Expected awaiting_plan_confirmation, got ${planResponse.phase}`);
    }

    console.log(`T02.5 step 1: plan created with ${planResponse.queue.length} contexts`);

    // Step 2: Подтверждаем план → process_entity_batch
    const confirmResponse = await runWorkflow("да, всё верно");

    // Step 3: Ожидаем extraction phase
    if (confirmResponse.phase === PHASE.awaiting_context_confirmation) {
      console.log(
        `T02.5 result: extracted "${confirmResponse.entity.position}" (${confirmResponse.progress.current}/${confirmResponse.progress.total})`,
      );
    } else if (confirmResponse.phase === PHASE.awaiting_clarification) {
      console.log(`T02.5 result: clarification needed for ${confirmResponse.missingFields.length} field(s)`);
    } else {
      expect.fail(`Expected extraction phase, got ${confirmResponse.phase}`);
    }
  }, 180_000);
});
