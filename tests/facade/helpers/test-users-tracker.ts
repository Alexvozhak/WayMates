import { createDriver } from "../../../src/core/neo4j.js";

import type { Session } from "neo4j-driver";
import type { UserId } from "../../../src/shared/schemas.js";

/**
 * Singleton Set для отслеживания test user IDs.
 * Используется для batch cleanup в afterAll.
 */
const testUserIds = new Set<UserId>();

/**
 * Добавить userId в трекер для последующего cleanup.
 * Вызывается в beforeEach каждого теста.
 */
export function trackTestUser(userId: UserId): void {
  testUserIds.add(userId);
}

async function deleteUserFromNeo4j(session: Session, userId: UserId): Promise<void> {
  try {
    await session.run(
      `
      MATCH (u:User {user_id: $userId})
      OPTIONAL MATCH (u)-[:HAS_CONTEXT]->(c:Context)
      OPTIONAL MATCH (u)-[:HAS_GOAL]->(g:Goal)
      DETACH DELETE u, c, g
      `,
      { userId },
    );
  } catch (error) {
    console.warn(`Failed to cleanup user ${userId}:`, error);
  }
}

/**
 * Удалить всех tracked users из Neo4j напрямую.
 * Вызывается в afterAll для batch cleanup.
 */
export async function cleanupAllTestUsers(): Promise<void> {
  if (testUserIds.size === 0) {
    return;
  }

  const driver = createDriver();
  const session = driver.session();

  try {
    for (const userId of testUserIds) {
      await deleteUserFromNeo4j(session, userId);
    }
  } finally {
    await session.close();
    await driver.close();
    testUserIds.clear();
  }
}
