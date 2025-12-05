import { postgresService } from "../../../../../src/facade/infrastructure/postgres.service.js";
import { getModel } from "../../../../../src/facade/langchain/shared-tools/models.js";
import { buildUnpackingPrompt } from "./unpacking-prompt.js";

import type { UserContext, UserId } from "../../../../../src/shared/schemas.js";
import type { FixtureData } from "./unpacking-prompt.js";

/**
 * Fields that can be omitted from fixture when generating incomplete stories.
 * Used in T08 to provoke clarification flow.
 *
 * The field is physically removed from fixture JSON before LLM processes it,
 * guaranteeing omission. This models real scenario: user forgot to mention data.
 *
 * Derived from UserContext to stay in sync with business schema.
 */
export type OmittableField = keyof Pick<UserContext, "birthYear" | "citizenships" | "educationLevel">;

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
 * @param omitField - поле для удаления из fixture (моделирует "пользователь забыл упомянуть")
 */
export async function generateStoryFromFixture(fixture: FixtureData, omitField?: OmittableField): Promise<string> {
  const processedFixture = omitField ? removeFieldFromFixture(fixture, omitField) : fixture;
  const prompt = buildUnpackingPrompt(processedFixture);
  const model = getModel("agent");
  const result = await model.invoke(prompt);
  return String(result.content);
}

function removeFieldFromFixture(fixture: FixtureData, field: OmittableField): FixtureData {
  return {
    ...fixture,
    contexts: fixture.contexts.map((ctx) => {
      const { [field]: _removed, ...rest } = ctx;
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- intentional field removal for testing incomplete data
      return rest as typeof ctx;
    }),
  };
}
