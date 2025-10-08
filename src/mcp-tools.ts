import neo4j, { type Driver, type Integer, type Node } from "neo4j-driver";
import {
  StoryInputSchema,
  UserContextSchema,
  TrailSchema,
  validateSchema,
  type StoryInput,
  type UserContext,
  type Trail,
  type UserId,
  type ContextId,
  type TrailId,
} from "./schemas-zod.js";

function toNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (neo4j.isInt?.(value)) {
    return (value as Integer).toNumber();
  }
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return undefined;
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  if (value && typeof value === "object" && "toArray" in value) {
    // Neo4j lists
    return (value as { toArray: () => unknown[] })
      .toArray()
      .filter((item): item is string => typeof item === "string");
  }
  if (typeof value === "string") {
    return [value];
  }
  return [];
}

function toDateTimeString(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value && typeof value === "object" && "toString" in value) {
    return (value as { toString: () => string }).toString();
  }
  throw new Error("Context is missing created_at timestamp");
}

function ensureSkillArray(
  value: unknown
): Array<{ name: string; category: string }> {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (entry): entry is { name: string; category: string } =>
        typeof entry?.name === "string" && typeof entry?.category === "string"
    )
    .map((entry) => ({ name: entry.name, category: entry.category }));
}

export async function getUserStory(
  driver: Driver,
  params: { user_id: UserId }
): Promise<StoryInput> {
  const session = driver.session();

  try {
    const userResult = await session.executeRead((tx) =>
      tx.run(
        `
          MATCH (u:User {user_id: $user_id})
          OPTIONAL MATCH (u)-[:HAS_CONTEXT]->(currentCtx:Context {context_id: u.current_context_id})-[:CITIZEN_OF]->(cit:Country)
          RETURN u AS user, collect(DISTINCT cit.name) AS citizenships
        `,
        { user_id: params.user_id }
      )
    );

    if (userResult.records.length === 0) {
      throw new Error(`User ${params.user_id} not found`);
    }

    const userNode = userResult.records[0]!.get("user") as Node;
    const citizenships =
      (userResult.records[0]!.get("citizenships") as string[]) ?? [];
    const userBirthYear = toNumber(userNode.properties?.birth_year);

    const contextsResult = await session.executeRead((tx) =>
      tx.run(
        `
          MATCH (u:User {user_id: $user_id})-[:HAS_CONTEXT]->(c:Context)
          OPTIONAL MATCH (c)-[:HAS_POSITION]->(p:Position)
          OPTIONAL MATCH (c)-[:IN_WORK_DOMAIN]->(wd:WorkDomain)
          OPTIONAL MATCH (c)-[:USES_SKILL]->(s:Skill)-[:IN_CATEGORY]->(sc:SkillCategory)
          WITH c, p,
               collect(DISTINCT wd.name) AS domains,
               collect(DISTINCT {name: s.name, category: sc.name}) AS rawSkills
          RETURN c, p.name AS position, domains, rawSkills
          ORDER BY c.created_at
        `,
        { user_id: params.user_id }
      )
    );

    const contexts: UserContext[] = contextsResult.records.map((record) => {
      const contextNode = record.get("c") as Node;
      const position = record.get("position") as string | undefined;
      const domains =
        (record.get("domains") as string[])?.filter(Boolean) ?? [];
      const skills = ensureSkillArray(record.get("rawSkills"));
      const teamSize = toNumber(contextNode.properties.team_size);
      const birthYearValue =
        toNumber(contextNode.properties.birth_year) ?? userBirthYear;

      if (!teamSize || teamSize < 1) {
        throw new Error(
          `Context ${contextNode.properties.context_id} is missing team_size`
        );
      }

      if (!birthYearValue) {
        throw new Error(
          `Context ${contextNode.properties.context_id} is missing birth_year`
        );
      }

      const context: UserContext = {
        context_id: contextNode.properties.context_id as string,
        previous_context_id:
          contextNode.properties.previous_context_id || undefined,
        next_context_id: contextNode.properties.next_context_id || undefined,
        created_at: toDateTimeString(contextNode.properties.created_at),
        creation_reason: toStringArray(contextNode.properties.creation_reason),
        position: position ?? (contextNode.properties.position as string),
        domains,
        skills,
        industry: contextNode.properties.industry as string,
        company_size: contextNode.properties.company_size as string,
        country_code: contextNode.properties.country_code as string,
        city_name: contextNode.properties.city_name as string,
        work_type: contextNode.properties.work_type as string,
        citizenships,
        team_size: teamSize,
        birth_year: birthYearValue,
      };

      return validateSchema(context, UserContextSchema);
    });

    const trailsResult = await session.executeRead((tx) =>
      tx.run(
        `
          MATCH (u:User {user_id: $user_id})-[:HAS_TRAIL]->(t:Trail)
          RETURN t
          ORDER BY t.trail_id
        `,
        { user_id: params.user_id }
      )
    );

    const trails: Trail[] = trailsResult.records.map((record) => {
      const trailNode = record.get("t") as Node;
      const trail: Trail = {
        skill: trailNode.properties.skill as string,
        platform: trailNode.properties.platform as string,
        from_context_id: trailNode.properties.from_context_id as string,
        to_context_id:
          (trailNode.properties.to_context_id as string | null | undefined) ??
          null,
        total_duration_weeks:
          toNumber(trailNode.properties.total_duration_weeks) ?? 0,
        schedule: {
          sessions_per_week:
            toNumber(trailNode.properties.sessions_per_week) ?? 0,
          hours_per_session:
            toNumber(trailNode.properties.hours_per_session) ?? 0,
        },
        cost_usd: toNumber(trailNode.properties.cost_usd) ?? 0,
        rating_course: toNumber(trailNode.properties.rating_course) ?? 0,
        rating_platform: toNumber(trailNode.properties.rating_platform) ?? 0,
        rating_schedule: toNumber(trailNode.properties.rating_schedule) ?? 0,
        course_name: (trailNode.properties.course_name as string) || undefined,
        course_link: (trailNode.properties.course_link as string) || undefined,
        user_feedback:
          (trailNode.properties.user_feedback as string) || undefined,
      };

      return validateSchema(trail, TrailSchema);
    });

    return StoryInputSchema.parse({
      user_id: params.user_id,
      contexts,
      trails,
    });
  } finally {
    await session.close();
  }
}

export async function deleteContext(
  driver: Driver,
  params: { user_id: UserId; context_id: ContextId }
): Promise<{ deleted: boolean }> {
  const session = driver.session();
  try {
    const ownershipResult = await session.executeRead((tx) =>
      tx.run(
        `
          MATCH (u:User {user_id: $user_id})
          OPTIONAL MATCH (u)-[:HAS_CONTEXT]->(c:Context {context_id: $context_id})
          WITH u, c
          OPTIONAL MATCH (u)-[:HAS_TRAIL]->(t:Trail)
            WHERE t.from_context_id = $context_id OR t.to_context_id = $context_id
          RETURN c IS NOT NULL AS ownsContext, count(t) AS trailsUsingContext
        `,
        params
      )
    );

    const ownershipRecord = ownershipResult.records[0];
    const ownsContext = ownershipRecord?.get("ownsContext") === true;
    const trailsUsing = Number(ownershipRecord?.get("trailsUsingContext") ?? 0);

    if (!ownsContext) {
      throw new Error("Context not found for the specified user");
    }

    if (trailsUsing > 0) {
      throw new Error("Context has associated trails. Delete trails first.");
    }

    const deleteResult = await session.executeWrite((tx) =>
      tx.run(
        `
          MATCH (u:User {user_id: $user_id})-[rel:HAS_CONTEXT]->(c:Context {context_id: $context_id})
          DETACH DELETE c
          RETURN count(rel) AS deleted
        `,
        params
      )
    );

    const deleted = Number(deleteResult.records[0]?.get("deleted") ?? 0) > 0;
    return { deleted };
  } finally {
    await session.close();
  }
}

export async function deleteTrail(
  driver: Driver,
  params: { user_id: UserId; trail_id: TrailId }
): Promise<{ deleted: boolean }> {
  const session = driver.session();
  try {
    const deleteResult = await session.executeWrite((tx) =>
      tx.run(
        `
          MATCH (u:User {user_id: $user_id})-[rel:HAS_TRAIL]->(t:Trail {trail_id: $trail_id})
          DETACH DELETE t
          RETURN count(rel) AS deleted
        `,
        params
      )
    );

    const deleted = Number(deleteResult.records[0]?.get("deleted") ?? 0) > 0;
    if (!deleted) {
      throw new Error("Trail not found for the specified user");
    }

    return { deleted };
  } finally {
    await session.close();
  }
}

export async function pingDatabase(driver: Driver): Promise<{
  status: "ok";
  timestamp: string;
}> {
  const session = driver.session();
  try {
    await session.run("RETURN 1 AS ok");
    return { status: "ok", timestamp: new Date().toISOString() };
  } finally {
    await session.close();
  }
}
