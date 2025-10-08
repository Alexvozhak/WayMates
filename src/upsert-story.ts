import type { Driver, Session, ManagedTransaction } from "neo4j-driver";
import { ulid } from "ulid";
import {
  type StoryInput,
  type UserContext,
  type Trail,
  type UserId,
  type ContextId,
  type TrailId,
  UserIdContext,
  UserIdTrail,
} from "./schemas-zod.js";
import { Upserts } from "./cypher/api.js";

export const generateContextId = (): ContextId => `ctx_${ulid()}`;
export const generateTrailId = (): TrailId => `trl_${ulid()}`;

type ContextIdMap = Map<string, ContextId>;

export async function executeUpsertStory(driver: Driver, story: StoryInput) {
  const session = driver.session();

  try {
    const contextIdMap = await upsertContextsBatch(session, {
      contexts: story.contexts,
      user_id: story.user_id,
    });

    updateTrailContextIds(story.trails, contextIdMap);

    const trailIds = await upsertTrailsBatch(session, {
      trails: story.trails,
      user_id: story.user_id,
    });

    return {
      success: true,
      contextsCreated: contextIdMap.size,
      trailsCreated: trailIds.length,
      contextIdMap,
    };
  } finally {
    await session.close();
  }
}

export async function executeUpsertContexts(
  driver: Driver,
  userIdContext: UserIdContext
): Promise<ContextIdMap> {
  const session = driver.session();
  try {
    return await upsertContextsBatch(session, userIdContext);
  } finally {
    await session.close();
  }
}

export async function executeUpsertTrails(
  driver: Driver,
  userIdTrail: UserIdTrail
): Promise<TrailId[]> {
  const session = driver.session();
  try {
    return await upsertTrailsBatch(session, userIdTrail);
  } finally {
    await session.close();
  }
}

async function upsertContextsBatch(
  session: Session,
  userIdContext: UserIdContext
): Promise<ContextIdMap> {
  const contextIdMap: ContextIdMap = new Map();

  for (const context of userIdContext.contexts) {
    const temporaryContextId = context.context_id;

    const ulidContextId = await upsertContextSingle(
      session,
      context,
      userIdContext.user_id
    );

    contextIdMap.set(temporaryContextId, ulidContextId);
  }

  return contextIdMap;
}

async function upsertTrailsBatch(
  session: Session,
  userIdTrail: UserIdTrail
): Promise<TrailId[]> {
  const trailIds: TrailId[] = [];
  for (const trail of userIdTrail.trails) {
    const trailId = await upsertTrailSingle(
      session,
      trail,
      userIdTrail.user_id
    );
    trailIds.push(trailId);
  }
  return trailIds;
}

async function upsertContextSingle(
  session: Session,
  context: UserContext,
  userId: UserId
): Promise<ContextId> {
  context.context_id = generateContextId();

  const params = {
    user_id: userId,
    context,
  };

  const res = await session.executeWrite((tx: ManagedTransaction) =>
    tx.run(Upserts.CREATE_CONTEXT, params)
  );

  if (!res.records.length) {
    throw new Error(
      `Context upsert failed: no records returned for ${context.context_id}`
    );
  }

  const returnedContextId = res.records[0]!.get("context_id");

  if (!returnedContextId) {
    throw new Error(
      `Context upsert failed: context_id is null for ${context.context_id}`
    );
  }

  if (returnedContextId !== context.context_id) {
    throw new Error(
      `Context ID mismatch: expected ${context.context_id}, got ${returnedContextId}`
    );
  }
  return returnedContextId;
}

async function upsertTrailSingle(
  session: Session,
  trail: Trail,
  userId: UserId
): Promise<TrailId> {
  const trailId: TrailId = generateTrailId();

  const res = await session.executeWrite((tx: ManagedTransaction) =>
    tx.run(Upserts.CREATE_TRAIL, {
      user_id: userId,
      trail_id: trailId,
      trail: trail,
      from_context_id: trail.from_context_id,
      to_context_id: trail.to_context_id ?? null,
    })
  );

  if (!res.records.length) {
    throw new Error(`Trail upsert failed: no records returned for ${trailId}`);
  }

  const returnedTrailId = res.records[0]!.get("trail_id");

  if (!returnedTrailId) {
    throw new Error(`Trail upsert failed: trail_id is null for ${trailId}`);
  }

  if (returnedTrailId !== trailId) {
    throw new Error(
      `Trail ID mismatch: expected ${trailId}, got ${returnedTrailId}`
    );
  }

  return returnedTrailId;
}

function updateTrailContextIds(
  trails: Trail[],
  contextIdMap: ContextIdMap
): void {
  trails.forEach((trail) => {
    if (contextIdMap.has(trail.from_context_id)) {
      trail.from_context_id = contextIdMap.get(trail.from_context_id)!;
    }
    if (trail.to_context_id && contextIdMap.has(trail.to_context_id)) {
      trail.to_context_id = contextIdMap.get(trail.to_context_id)!;
    }
  });
}
