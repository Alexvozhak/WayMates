import { getModel } from "../../../../../src/facade/langGraph/shared-tools/models.js";
import { FacadeTestContext } from "../../../helpers/test-context.js";
import { buildUnpackingPrompt } from "./unpacking-prompt.js";

import type { UserContext, UserId } from "../../../../../src/shared/schemas.js";
import type { FixtureData } from "./unpacking-prompt.js";

export type OmittableField = keyof Pick<UserContext, "birthYear" | "citizenships" | "educationLevel">;

export async function cleanupColdStart(userId: UserId, threadId: string): Promise<void> {
  const ctx = FacadeTestContext.getInstance();
  await ctx.userService.resetColdStartStatus(userId);
  await ctx.checkpointService.delete(threadId);
  await ctx.coreClient.client.story.deleteStory.mutate({ userId });
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
