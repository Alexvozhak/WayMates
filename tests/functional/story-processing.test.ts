import { describe, test, expect, beforeEach, afterEach } from "vitest";
import type { Driver, Session } from "neo4j-driver";
import { executeUpsertStory } from "../../src/upsert-story.js";
import {
  setupIntegrationTest,
  teardownIntegrationTest,
} from "../helpers/database-setup.js";
import { loadTestData } from "../helpers/test-data-loader.js";

describe("Story processing functional flow", () => {
  let driver: Driver;
  let session: Session;

  beforeEach(async () => {
    ({ driver, session } = await setupIntegrationTest());
  });

  afterEach(async () => {
    await teardownIntegrationTest(session, driver);
  });

  test("processes complete user story end-to-end", async () => {
    const story = loadTestData("USER_001");

    const result = await executeUpsertStory(driver, story);
    expect(result.success).toBe(true);
    expect(result.contextsCreated).toBe(story.contexts.length);
    expect(result.trailsCreated).toBe(story.trails.length);

    const summary = await session.executeRead((tx) =>
      tx.run(
        `
          MATCH (u:User {user_id: $user_id})
          OPTIONAL MATCH (u)-[:HAS_CONTEXT]->(c:Context)
          OPTIONAL MATCH (u)-[:HAS_TRAIL]->(t:Trail)
          RETURN count(DISTINCT c) AS context_count,
                 count(DISTINCT t) AS trail_count
        `,
        { user_id: story.user_id }
      )
    );

    const contextCount = Number(summary.records[0]?.get("context_count"));
    const trailCount = Number(summary.records[0]?.get("trail_count"));

    expect(contextCount).toBe(story.contexts.length);
    expect(trailCount).toBe(story.trails.length);
  });

  test("creates user profile with all trail data", async () => {
    const story = loadTestData("USER_002");
    await executeUpsertStory(driver, story);

    const trailsResult = await session.executeRead((tx) =>
      tx.run(
        `
          MATCH (u:User {user_id: $user_id})-[:HAS_TRAIL]->(t:Trail)
          RETURN t.skill AS skill,
                 t.platform AS platform,
                 t.total_duration_weeks AS duration_weeks,
                 t.cost_usd AS cost_usd
          ORDER BY t.skill, t.platform
        `,
        { user_id: story.user_id }
      )
    );

    expect(trailsResult.records).toHaveLength(story.trails.length);

    const expectedTrails = story.trails
      .map((trail) => ({
        skill: trail.skill,
        platform: trail.platform,
        duration_weeks: trail.total_duration_weeks,
        cost_usd: trail.cost_usd,
      }))
      .sort(
        (a, b) =>
          a.skill.localeCompare(b.skill) || a.platform.localeCompare(b.platform)
      );

    const actualTrails = trailsResult.records.map((record) => ({
      skill: record.get("skill") as string,
      platform: record.get("platform") as string,
      duration_weeks: Number(record.get("duration_weeks")),
      cost_usd: Number(record.get("cost_usd")),
    }));

    expect(actualTrails).toEqual(expectedTrails);
  });

  test("handles multiple user stories correctly", async () => {
    const users = ["USER_001", "USER_003"] as const;
    for (const key of users) {
      await executeUpsertStory(driver, loadTestData(key));
    }

    const stats = await session.executeRead((tx) =>
      tx.run(
        `
          MATCH (u:User)
          OPTIONAL MATCH (u)-[:HAS_CONTEXT]->(c:Context)
          OPTIONAL MATCH (u)-[:HAS_TRAIL]->(t:Trail)
          WITH u, count(DISTINCT c) AS contexts, count(DISTINCT t) AS trails
          RETURN collect({ user_id: u.user_id, contexts: contexts, trails: trails }) AS summaries
        `
      )
    );

    const summaries = stats.records[0]?.get("summaries") as Array<{
      user_id: string;
      contexts: number;
      trails: number;
    }>;

    expect(summaries).toBeDefined();
    expect(summaries).toEqual(
      expect.arrayContaining(
        users.map((key) => {
          const story = loadTestData(key);
          return {
            user_id: story.user_id,
            contexts: story.contexts.length,
            trails: story.trails.length,
          };
        })
      )
    );
  });

  test("processes real migrated data files", async () => {
    const keys = ["USER_004", "USER_005", "USER_006"] as const;

    for (const key of keys) {
      const story = loadTestData(key);
      const result = await executeUpsertStory(driver, story);
      expect(result.success).toBe(true);
    }

    const totalUsers = await session.executeRead((tx) =>
      tx.run(
        `
          MATCH (u:User)
          WHERE u.user_id IN $userIds
          RETURN count(DISTINCT u) AS count
        `,
        {
          userIds: keys.map((k) => loadTestData(k).user_id),
        }
      )
    );

    expect(Number(totalUsers.records[0]?.get("count"))).toBe(keys.length);
  });
});
