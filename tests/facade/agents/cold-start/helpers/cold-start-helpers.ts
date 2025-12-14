import { getModel } from "../../../../../src/facade/langGraph/shared-tools/models.js";
import { FacadeTestContext } from "../../../helpers/test-context.js";
import { buildUnpackingPrompt } from "./unpacking-prompt.js";

import type { Trail, UserContext, UserId } from "../../../../../src/shared/schemas.js";
import type {
  ExtractableContext,
  ExtractableTrail,
} from "../../../../../src/facade/langGraph/shared-tools/extraction-models.js";
import type { ContextAgenda } from "../../../../../src/facade/langGraph/cold-start-v2/state.js";
import type { FixtureData } from "./unpacking-prompt.js";

export type OmittableField = keyof Pick<UserContext, "birthYear" | "citizenships" | "educationLevel">;

export async function cleanupColdStart(userId: UserId, threadId: string): Promise<void> {
  const ctx = FacadeTestContext.getInstance();
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

/**
 * Converts UserContext from fixtures (U1-U18) to ExtractableContext.
 * ExtractableContext has all fields nullable (for LLM extraction).
 */
/* eslint-disable-next-line complexity -- Test helper with many nullable fields */
export function toExtractableContext(ctx: UserContext): ExtractableContext {
  return {
    contextId: ctx.contextId,
    previousContextId: ctx.previousContextId ?? null,
    nextContextId: ctx.nextContextId ?? null,
    createdAt: ctx.createdAt,
    creationReason: ctx.creationReason,
    position: ctx.position,
    domains: ctx.domains,
    skills: ctx.skills,
    industry: ctx.industry,
    companySize: ctx.companySize,
    countryCode: ctx.countryCode,
    cityName: ctx.cityName,
    citizenships: ctx.citizenships,
    birthYear: ctx.birthYear,
    educationLevel: ctx.educationLevel ?? null,
    salaryExact: ctx.salaryExact ?? null,
    salaryMin: ctx.salaryMin ?? null,
    salaryMax: ctx.salaryMax ?? null,
    languages: ctx.languages ?? null,
    feedback: ctx.feedback ?? null,
  };
}

/**
 * Converts Trail from fixtures (U10, U12) to ExtractableTrail.
 */
/* eslint-disable-next-line complexity -- Test helper with many nullable fields */
export function toExtractableTrail(trail: Trail): ExtractableTrail {
  return {
    trailId: trail.trailId,
    fromContextId: trail.fromContextId,
    toContextId: trail.toContextId,
    skill: trail.skill,
    platform: trail.platform,
    totalDurationWeeks: trail.totalDurationWeeks ?? null,
    schedule: trail.schedule ?? null,
    costUsd: trail.costUsd ?? null,
    ratingCourse: trail.ratingCourse ?? null,
    ratingPlatform: trail.ratingPlatform ?? null,
    ratingSchedule: trail.ratingSchedule ?? null,
    courseName: trail.courseName ?? null,
    courseLink: trail.courseLink ?? null,
    userFeedback: trail.userFeedback ?? null,
  };
}

/**
 * Creates ContextAgenda from UserContext for testing.
 */
export function createAgendaFromContext(ctx: UserContext): ContextAgenda {
  return {
    contextId: ctx.contextId,
    preview: `${ctx.position} at ${ctx.industry}`,
    incomingTrails: [],
  };
}
