import { postgresService } from "../../../../src/facade/infrastructure/postgres.service.js";
import { getModel } from "../../../../src/facade/langchain/shared-tools/models.js";
import { buildUnpackingPrompt } from "../unpacking-prompt.js";

import type { UserId } from "../../../../src/shared/schemas.js";
import type { FixtureData } from "../unpacking-prompt.js";

/**
 * Cleanup PostgreSQL state для cold-start тестов.
 * Вызывается в beforeEach для изоляции между тестами.
 *
 * Очищает:
 * - PostgreSQL: cold_start_completions flag (для T04 idempotency)
 * - PostgreSQL: checkpoints для threadId (для T15 checkpoint cleanup)
 *
 * NOTE: НЕ очищает Redis session - это делается в afterEach
 */
export async function cleanupColdStart(userId: UserId, threadId: string): Promise<void> {
  await postgresService.resetColdStartStatus(userId);
  await postgresService.deleteCheckpoint(threadId);
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
