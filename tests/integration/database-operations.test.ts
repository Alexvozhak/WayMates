import { describe, test, expect, beforeEach, afterEach } from "vitest";
import type { Driver, Session } from "neo4j-driver";
import { executeUpsertStory } from "../../src/upsert-story.js";
import {
  setupIntegrationTest,
  teardownIntegrationTest,
} from "../helpers/database-setup.js";
import { loadTestData, loadAllTestData } from "../helpers/test-data-loader.js";

describe("Database operations integration", () => {
  let driver: Driver;
  let session: Session;

  beforeEach(async () => {
    ({ driver, session } = await setupIntegrationTest());
  });

  afterEach(async () => {
    await teardownIntegrationTest(session, driver);
  });

  test("creates Platform and SkillPlatformNode relationships", async () => {
    const storyData = loadTestData("USER_001");
    await executeUpsertStory(driver, storyData);

    const platformResult = await session.executeRead((tx) =>
      tx.run(
        `
          MATCH (p:Platform)
          RETURN collect(p.name) AS platforms
        `
      )
    );

    const platforms = platformResult.records[0]?.get("platforms");
    expect(platforms).toContain("udemy");
    expect(platforms).toContain("mentorship");

    const skillPlatformResult = await session.executeRead((tx) =>
      tx.run(
        `
          MATCH (t:Trail)-[:DEVELOPS]->(spn:SkillPlatformNode)-[:ON_PLATFORM]->(p:Platform)
          RETURN spn.skill AS skill, p.name AS platform
          ORDER BY skill
        `
      )
    );

    const skillPlatforms = skillPlatformResult.records.map((record) => ({
      skill: record.get("skill"),
      platform: record.get("platform"),
    }));

    expect(skillPlatforms).toContainEqual({
      skill: "angular",
      platform: "udemy",
    });
    expect(skillPlatforms).toContainEqual({
      skill: "ngrx",
      platform: "mentorship",
    });
  });

  test("creates STEPS_ON relationships for trails", async () => {
    const testUsers = ["USER_001", "USER_002"] as const;

    for (const userKey of testUsers) {
      await executeUpsertStory(driver, loadTestData(userKey));
    }

    const stepsOnResult = await session.executeRead((tx) =>
      tx.run(
        `
          MATCH (from:Context)-[:STEPS_ON]->(t:Trail)
          RETURN collect({ from_id: from.context_id, trail_id: t.trail_id }) AS relationships
        `
      )
    );

    const relationships = stepsOnResult.records[0]?.get(
      "relationships"
    ) as Array<{
      from_id: string;
      trail_id: string;
    }>;

    expect(relationships).toHaveLength(4);
    relationships.forEach((rel) => {
      expect(rel.from_id).toMatch(/^ctx_/);
      expect(rel.trail_id).toMatch(/^trl_/);
    });
  });

  test("handles trails with null to_context_id (ongoing trails)", async () => {
    const testData = loadTestData("USER_005");
    const ongoingTrail = testData.trails[0]!;
    ongoingTrail.to_context_id = null;

    await expect(executeUpsertStory(driver, testData)).resolves.toBeDefined();

    const ongoingResult = await session.executeRead((tx) =>
      tx.run(
        `
          MATCH (t:Trail {skill: $skill, platform: $platform})
          WHERE t.to_context_id IS NULL
          RETURN t.course_name AS course_name
        `,
        {
          skill: ongoingTrail.skill,
          platform: ongoingTrail.platform,
        }
      )
    );

    expect(ongoingResult.records[0]).toBeDefined();
    expect(ongoingResult.records[0]!.get("course_name")).toBe(
      ongoingTrail.course_name
    );
  });

  test("Database constraints prevent duplicate trail IDs", async () => {
    const duplicateId = "trl_duplicate_test";

    await session.executeWrite((tx) =>
      tx.run(
        `CREATE (:Trail {trail_id: $trail_id, skill: 'test', platform: 'platform'})`,
        { trail_id: duplicateId }
      )
    );

    await expect(
      session.executeWrite((tx) =>
        tx.run(
          `CREATE (:Trail {trail_id: $trail_id, skill: 'other', platform: 'platform'})`,
          { trail_id: duplicateId }
        )
      )
    ).rejects.toThrow();

    const countResult = await session.executeRead((tx) =>
      tx.run(`MATCH (t:Trail {trail_id: $trail_id}) RETURN count(t) AS count`, {
        trail_id: duplicateId,
      })
    );

    expect(Number(countResult.records[0]?.get("count"))).toBe(1);
  });

  test("Cypher queries handle large datasets efficiently", async () => {
    const allUsers = loadAllTestData();

    console.log(
      `📊 Импортируем ${allUsers.length} пользователей в базу данных...`
    );

    let totalContexts = 0;
    let totalTrails = 0;

    // Импортируем всех пользователей по очереди
    for (const [index, userStory] of allUsers.entries()) {
      const result = await executeUpsertStory(driver, userStory);
      expect(result.success).toBe(true);

      totalContexts += result.contextsCreated;
      totalTrails += result.trailsCreated;

      if ((index + 1) % 10 === 0) {
        console.log(
          `✅ Импортировано ${index + 1}/${allUsers.length} пользователей`
        );
      }
    }

    console.log(
      `🎯 Итого: ${totalContexts} контекстов, ${totalTrails} трейлов`
    );

    // Проверяем что все данные корректно импортированы
    const contextCountResult = await session.executeRead((tx) =>
      tx.run(`MATCH (c:Context) RETURN count(c) AS count`)
    );

    const trailCountResult = await session.executeRead((tx) =>
      tx.run(`MATCH (t:Trail) RETURN count(t) AS count`)
    );

    const userCountResult = await session.executeRead((tx) =>
      tx.run(`MATCH (u:User) RETURN count(u) AS count`)
    );

    expect(Number(contextCountResult.records[0]?.get("count"))).toBe(
      totalContexts
    );
    expect(Number(trailCountResult.records[0]?.get("count"))).toBe(totalTrails);
    expect(Number(userCountResult.records[0]?.get("count"))).toBe(
      allUsers.length
    );
  });

  test("Transaction rollback works on database errors", async () => {
    const markerId = "rollback_marker";

    await expect(
      session.executeWrite(async (tx) => {
        await tx.run(`CREATE (:TempNode {id: $id})`, { id: markerId });
        await tx.run(`CREATE (:Trail {trail_id: $trail_id})`, {
          trail_id: "trl_rollback",
        });
        await tx.run(`CREATE (:Trail {trail_id: $trail_id})`, {
          trail_id: "trl_rollback",
        });
      })
    ).rejects.toThrow();

    const verification = await session.executeRead((tx) =>
      tx.run(`MATCH (n:TempNode {id: $id}) RETURN count(n) AS count`, {
        id: markerId,
      })
    );

    expect(Number(verification.records[0]?.get("count"))).toBe(0);
  });

  test("Database has required indexes for performance", async () => {
    // Получаем список всех индексов в базе данных
    const indexResult = await session.executeRead((tx) =>
      tx.run(
        `
          SHOW INDEXES
          YIELD name, state, labelsOrTypes, properties
          RETURN collect({
            name: name,
            state: state,
            nodeLabel: head(labelsOrTypes),  // Метка узла (например, "Trail")
            property: head(properties)       // Свойство (например, "platform")
          }) AS indexes
        `
      )
    );

    const indexes = indexResult.records[0]?.get("indexes") as Array<{
      name: string;
      state: string;
      nodeLabel: string;
      property: string;
    }>;

    // Проверяем что существует индекс для Trail.platform
    // Этот индекс критичен для производительности поисковых запросов
    const trailPlatformIndex = indexes.find(
      (idx) => idx.nodeLabel === "Trail" && idx.property === "platform"
    );

    expect(trailPlatformIndex).toBeDefined();
    expect(trailPlatformIndex?.state).toBe("ONLINE");

    console.log(
      `✅ Найден индекс: ${trailPlatformIndex?.name} (${trailPlatformIndex?.state})`
    );
  });
});
