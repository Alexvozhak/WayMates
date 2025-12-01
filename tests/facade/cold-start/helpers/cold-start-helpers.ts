import { postgresService } from "../../../../src/facade/infrastructure/postgres.service.js";
import { getModel } from "../../../../src/facade/langchain/shared-tools/models.js";
import { cleanupSession } from "../../helpers/mcp-tool-helpers.js";
import { buildUnpackingPrompt } from "../unpacking-prompt.js";

import type { UserId } from "../../../../src/shared/schemas.js";
import type { FixtureData } from "../unpacking-prompt.js";

/**
 * Cleanup PostgreSQL + Redis для cold-start тестов.
 * Вызывается в beforeEach для изоляции между тестами.
 *
 * Очищает:
 * - PostgreSQL: cold_start_completions flag (для T04 idempotency)
 * - PostgreSQL: checkpoints для threadId (для T15 checkpoint cleanup)
 * - Redis: session keys
 */
export async function cleanupColdStart(userId: UserId, threadId: string, sessionId: string): Promise<void> {
  await postgresService.resetColdStartStatus(userId);
  await postgresService.deleteCheckpoint(threadId);
  await cleanupSession(sessionId);
}

/**
 * Генерация story из fixture через LLM.
 * Использует buildUnpackingPrompt для преобразования JSON → текстовая история.
 */
export async function generateStoryFromFixture(fixture: FixtureData): Promise<string> {
  const prompt = buildUnpackingPrompt(fixture);
  const model = getModel("agent");
  const result = await model.invoke(prompt);
  return String(result.content);
}
