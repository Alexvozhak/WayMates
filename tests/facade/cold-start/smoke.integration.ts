import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from "vitest";

import { postgresService } from "../../../src/facade/infrastructure/postgres.service.js";
import { runColdStartWorkflow } from "../../../src/facade/langchain/cold-start/cold-start-agent.js";
import { setupSession, cleanupSession } from "../helpers/mcp-tool-helpers.js";
import { trackTestUser, cleanupAllTestUsers } from "../helpers/test-users-tracker.js";
import { UserStories } from "../../core/helpers/user-stories.js";

import { cleanupColdStart, generateStoryFromFixture } from "./helpers/cold-start-helpers.js";

import type { SessionId } from "../../../src/facade/mcp-server/result.js";
import type { UserId } from "../../../src/shared/schemas.js";

describe("Cold-Start Smoke Tests (P0)", () => {
  let testSessionId: SessionId;
  const testUserId: UserId = "usr_smoke_01933ec5-0000-0000-0000-000000000001";
  const threadId = `cold_start_${testUserId}`;

  // PostgreSQL инициализация для checkpointer
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

  // T01: Agent workflow живой
  it("T01: Agent workflow responds (LangChain v1 config check)", async () => {
    // Business rule: Agent должен отвечать story_gathering при холодном старте.
    // Проверяет что LangChain v1 + PostgresSaver + Gemini model настроены корректно.

    const message = "Hello";

    const response = await runColdStartWorkflow(message, threadId, testUserId);

    // Business assertion: Phase должна быть story_gathering (начальная фаза)
    expect(response.phase).toBe("story_gathering");
  });

  // T02: Story → Agent responds (minimal happy path)
  it("T02: Story processed by agent (minimal happy path)", async () => {
    // Business rule: Agent должен обработать историю без ошибок.
    // Проверяет: story generation → agent processing → valid phase.
    // NOTE: Конкретная phase (story_gathering vs awaiting_plan_confirmation)
    // зависит от LLM — оба результата валидны для smoke test.

    const userStories = new UserStories();
    const u1 = userStories.getStoryBy("U1");

    // Генерация story через LLM (используя unpacking prompt)
    const story = await generateStoryFromFixture(u1);

    // Передача story в agent
    const response = await runColdStartWorkflow(story, threadId, testUserId);

    // Business assertions: agent не упал и вернул валидную фазу
    expect(response.phase).not.toBe("failed");
    expect(response.phase).not.toBe("already_saved");

    // Логируем результат для отладки
    console.log(`T02 result phase: ${response.phase}`);
  }, 120_000);
});
