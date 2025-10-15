import { expect } from "vitest";
import { loadTestData, type UserKey } from "./test-data-loader.js";
import type { Driver, ManagedTransaction } from "neo4j-driver";
import { PersistenceManager } from "../../src/persistence-manager.js";
import { withReadSession } from "../../src/neo4j.js";
import { CONTEXT_ID_PATTERN, TRAIL_ID_PATTERN } from "../../src/schemas-zod.js";

/** Regex helpers for ULID-prefixed IDs */
const ctxRe = new RegExp(CONTEXT_ID_PATTERN);
const trlRe = new RegExp(TRAIL_ID_PATTERN);

export function expectContextId(id: string) {
  expect(ctxRe.test(id)).toBe(true);
}

export function expectTrailId(id: string) {
  expect(trlRe.test(id)).toBe(true);
}

/**
 * Upsert a single context for given userKey + index, return tuple.
 */
export async function upsertAndGetContext(
  driver: Driver,
  manager: PersistenceManager,
  userKey: UserKey,
  contextIndex = 0
): Promise<{ userId: string; context: any; contextId: string }> {
  const testData = loadTestData(userKey);
  const context = testData.contexts[contextIndex]!;
  const result = await manager.upsertContexts({
    user_id: testData.user_id,
    contexts: [context],
  });
  expect(result.success).toBe(true);
  expect(context.context_id).toBeDefined();
  expectContextId(context.context_id);
  return { userId: testData.user_id, context, contextId: context.context_id };
}

/**
 * Assert total count of nodes with given label equals expected.
 */
export async function expectNodeCount(
  driver: Driver,
  label: string,
  expected: number
) {
  const { records } = await withReadSession(driver, (tx: ManagedTransaction) =>
    tx.run(`MATCH (n:${label}) RETURN count(n) AS cnt`)
  );
  expect(records[0]?.get("cnt") ?? 0).toBe(expected);
}
