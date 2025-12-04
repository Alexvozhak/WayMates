import { postgresService } from "../../../../../src/facade/infrastructure/postgres.service.js";
import { getModel } from "../../../../../src/facade/langchain/shared-tools/models.js";
import { buildUnpackingPrompt } from "./unpacking-prompt.js";

import type { UserId } from "../../../../../src/shared/schemas.js";
import type { FixtureData } from "./unpacking-prompt.js";

/**
 * Omission instructions for generating incomplete stories.
 * Used in T08 to provoke clarification flow.
 */
export const OMISSION_INSTRUCTIONS = {
  birthYear: "\n\nКРИТИЧНО: НЕ упоминай возраст, год рождения или сколько лет. Это поле должно остаться неизвестным.",
  citizenships: "\n\nКРИТИЧНО: НЕ упоминай гражданство или национальность. Это поле должно остаться неизвестным.",
  educationLevel: "\n\nКРИТИЧНО: НЕ упоминай образование или где учился. Это поле должно остаться неизвестным.",
};

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
 *
 * @param fixture - JSON данные для преобразования
 * @param omissionInstruction - опциональная инструкция об исключении полей (из OMISSION_INSTRUCTIONS)
 */
export async function generateStoryFromFixture(fixture: FixtureData, omissionInstruction?: string): Promise<string> {
  const basePrompt = buildUnpackingPrompt(fixture);
  const prompt = omissionInstruction ? basePrompt + omissionInstruction : basePrompt;
  const model = getModel("agent");
  const result = await model.invoke(prompt);
  return String(result.content);
}
