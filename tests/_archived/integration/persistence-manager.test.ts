import {
  describe,
  beforeEach,
  beforeAll,
  afterAll,
} from "vitest";

import type { Driver } from "neo4j-driver";
import { TestDataManager, UserKey } from "../helpers/test-data-manager.js";
import { PersistenceManager } from "../../src/persistence-manager.js";
import {
  createDriver,
  withWriteSession,
} from "../../src/neo4j.js";

describe.skip("Persistence Manager Integration Tests", () => {
  let driver: Driver;
  let persistenceManager: PersistenceManager;
  let testDataManager: TestDataManager;

  beforeAll(() => {
    driver = createDriver();
    persistenceManager = new PersistenceManager(driver);
    testDataManager = new TestDataManager();
  });

  beforeEach(async () => {
    await withWriteSession(driver, async (tx) => {
      await tx.run("MATCH (n) DETACH DELETE n");
    });
  });

  afterAll(async () => {
    await driver.close();
  });

  async function upsertStory(userKey: UserKey) {
    const testData = testDataManager.getStoryBy(userKey);
    const result = await persistenceManager.upsertStory(testData);
    return { testData, result };
  }

  async function upsertContext(userKey: UserKey, contextIndex: number) {
    const testData = testDataManager.getStoryBy(userKey);
    const context = testData.contexts[contextIndex]!;
    const result = await persistenceManager.upsertContexts({
      user_id: testData.user_id,
      contexts: [context],
    });
    return {
      testData,
      result,
    };
  }
  async function upsertTrail(userKey: UserKey, trailIndex: number) {
    const testData = testDataManager.getStoryBy(userKey);
    const trail = testData.trails[trailIndex]!;
    const result = await persistenceManager.upsertTrails({
      user_id: testData.user_id,
      trails: [trail],
    });
    return { testData, result };
  }

  // describe("Upserts.CREATE_CONTEXT", () => {
  //   test("creates user and context with basic properties", async () => {
  //     const { testData, result } = await upsertContext("USER_001", 0);
  //     const userId = testData.user_id;
  //     const context = testData.contexts[0]!;
  //     const contextId = context.context_id;
  //     // Basic assertions done in helper: success and contextId defined

  //     const userCheck = await withReadSession(driver, (tx) =>
  //       tx.run("MATCH (u:User {user_id: $userId}) RETURN u.birth_year", {
  //         userId,
  //       })
  //     );
  //     expect(userCheck.records[0]!.get("u.birth_year")).toBe(
  //       context.birth_year
  //     );

  //     const relationCheck = await withReadSession(driver, (tx) =>
  //       tx.run(
  //         "MATCH (u:User {user_id: $userId})-[r:HAS_CONTEXT]->(c:Context {context_id: $contextId}) RETURN r",
  //         { userId, contextId }
  //       )
  //     );
  //     expect(relationCheck.records.length).toBeGreaterThan(0);
  //   });

  //   test("duplicates context fields as properties for fast search", async () => {
  //     const { context: inputContext, contextId: firstContextId } =
  //       await upsertContext(driver, persistenceManager, "USER_001", 0);
  //     const contextResult = await withWriteSession(driver, async (tx) => {
  //       return tx.run(`MATCH (c:Context {context_id: $context_id}) RETURN c`, {
  //         context_id: firstContextId,
  //       });
  //     });
  //     expect(contextResult.records.length).toBeGreaterThan(0);
  //     const dbProps = contextResult.records[0]!.get("c").properties;

  //     expect(dbProps.position).toBe(inputContext.position);
  //     expect(dbProps.industry).toBe(inputContext.industry);
  //     expect(dbProps.country_code).toBe(inputContext.country_code);
  //     expect(dbProps.city_name).toBe(inputContext.city_name);
  //     expect(dbProps.work_type).toBe(inputContext.work_type);
  //     expect(dbProps.company_size).toBe(inputContext.company_size);
  //     expect(dbProps.team_size).toBe(inputContext.team_size);
  //     expect(dbProps.domains).toEqual(inputContext.domains);
  //     expect(dbProps.skills).toEqual(
  //       inputContext.skills.map((s: any) => s.name)
  //     );
  //     expect(dbProps.citizenships).toEqual(inputContext.citizenships);
  //     expect(dbProps.creation_reason).toEqual(inputContext.creation_reason);
  //     expect(dbProps.created_at).toBeDefined();

  //     // Verify exact node counts to catch duplicates
  //     await expectNodeCount(driver, "WorkDomain", inputContext.domains.length);
  //     await expectNodeCount(driver, "Skill", inputContext.skills.length);
  //     // Count unique countries (location + citizenships, deduplicated)
  //     const uniqueCountries = new Set([
  //       inputContext.country_code,
  //       ...inputContext.citizenships,
  //     ]);
  //     await expectNodeCount(driver, "Country", uniqueCountries.size);
  //     await expectNodeCount(driver, "City", 1);
  //   });

  //   test("creates position relationship", async () => {
  //     const { context, contextId } = await upsertContext(
  //       driver,
  //       persistenceManager,
  //       "USER_001",
  //       1
  //     );
  //     const positionCheck = await withReadSession(driver, (tx) =>
  //       tx.run(
  //         `MATCH (c:Context {context_id: $context_id})-[:HAS_POSITION]->(p:Position)
  //          RETURN p.name`,
  //         { context_id: contextId }
  //       )
  //     );
  //     expect(positionCheck.records[0]!.get("p.name")).toBe(context.position);
  //   });

  //   test("creates industry relationship", async () => {
  //     const { context, contextId } = await upsertContext(
  //       driver,
  //       persistenceManager,
  //       "USER_001",
  //       1
  //     );
  //     const industryCheck = await withReadSession(driver, (tx) =>
  //       tx.run(
  //         `MATCH (c:Context {context_id: $context_id})-[:IN_INDUSTRY]->(i:Industry)
  //          RETURN i.name`,
  //         { context_id: contextId }
  //       )
  //     );
  //     expect(industryCheck.records[0]!.get("i.name")).toBe(context.industry);
  //   });

  //   test("creates graph relationships for skills and categories", async () => {
  //     const { context, contextId } = await upsertContext(
  //       driver,
  //       persistenceManager,
  //       "USER_001",
  //       1
  //     );
  //     const skillsCheck = await withReadSession(driver, (tx) =>
  //       tx.run(
  //         `MATCH (c:Context {context_id: $context_id})-[:USES_SKILL]->(s:Skill)-[:IN_CATEGORY]->(sc:SkillCategory)
  //          RETURN s.name ORDER BY s.name`,
  //         { context_id: contextId }
  //       )
  //     );
  //     const skillNames = skillsCheck.records.map((r) => r.get("s.name"));
  //     const expectedSkills = context.skills.map((s: any) => s.name);
  //     expect(skillNames).toEqual(expect.arrayContaining(expectedSkills));
  //   });

  //   test("creates work domain relationships", async () => {
  //     const { context, contextId } = await upsertContext(
  //       driver,
  //       persistenceManager,
  //       "USER_001",
  //       1
  //     );
  //     const domainsCheck = await withReadSession(driver, (tx) =>
  //       tx.run(
  //         `MATCH (c:Context {context_id: $context_id})-[:IN_WORK_DOMAIN]->(wd:WorkDomain)
  //          RETURN wd.name ORDER BY wd.name`,
  //         { context_id: contextId }
  //       )
  //     );
  //     const domainNames = domainsCheck.records.map((r) => r.get("wd.name"));
  //     expect(domainNames).toEqual(expect.arrayContaining(context.domains));
  //   });

  //   test("creates location relationships", async () => {
  //     const { context, contextId } = await upsertContext(
  //       driver,
  //       persistenceManager,
  //       "USER_001",
  //       1
  //     );
  //     const locationCheck = await withReadSession(driver, (tx) =>
  //       tx.run(
  //         `MATCH (c:Context {context_id: $context_id})-[:IN_CITY]->(city:City)-[:IN_COUNTRY]->(country:Country)
  //          RETURN city.name, country.name`,
  //         { context_id: contextId }
  //       )
  //     );
  //     expect(locationCheck.records).toHaveLength(1);
  //     expect(locationCheck.records[0]!.get("city.name")).toBe(
  //       context.city_name
  //     );
  //     expect(locationCheck.records[0]!.get("country.name")).toBe(
  //       context.country_code
  //     );
  //   });

  //   test("creates citizenship relationships", async () => {
  //     const { userId, context, contextId } = await upsertContext(
  //       driver,
  //       persistenceManager,
  //       "USER_001",
  //       1
  //     );
  //     const citizenshipCheck = await withReadSession(driver, (tx) =>
  //       tx.run(
  //         `MATCH (u:User {user_id: $userId})-[:HAS_CONTEXT]->(c:Context {context_id: $contextId})-[:CITIZEN_OF]->(ct:Country)
  //          RETURN ct.name ORDER BY ct.name`,
  //         { userId, contextId }
  //       )
  //     );
  //     const names = citizenshipCheck.records.map((r) => r.get("ct.name"));
  //     expect(names).toEqual(expect.arrayContaining(context.citizenships));
  //   });

  //   /**
  //    * Вспомогательный метод: обновляет контекст одной из двух «граней» и проверяет результат.
  //    */
  //   async function updateAndAssert(aspect: "properties" | "skills") {
  //     const testData = loadTestData("USER_002");
  //     const firstContext = testData.contexts[0]!;
  //     const secondContext = testData.contexts[1]!;

  //     // Первое сохранение контекста
  //     await upsertContext(driver, persistenceManager, "USER_002", 0);
  //     const contextId = firstContext.context_id;

  //     // Готовим patch-объект
  //     const patch =
  //       aspect === "properties"
  //         ? {
  //             industry: secondContext.industry,
  //             position: secondContext.position,
  //             city_name: secondContext.city_name,
  //           }
  //         : { skills: secondContext.skills };

  //     const updatedContext = {
  //       ...firstContext,
  //       context_id: contextId,
  //       ...patch,
  //     };

  //     const res = await persistenceManager.upsertContexts({
  //       user_id: testData.user_id,
  //       contexts: [updatedContext],
  //     });
  //     expect(res.success).toBe(true);

  //     if (aspect === "properties") {
  //       const { records } = await withReadSession(driver, (tx) =>
  //         tx.run(
  //           `MATCH (c:Context {context_id: $id})
  //            RETURN c.industry AS ind, c.position AS pos, c.city_name AS city`,
  //           { id: contextId }
  //         )
  //       );
  //       const rec = records[0]!;
  //       expect(rec.get("ind")).toBe(secondContext.industry);
  //       expect(rec.get("pos")).toBe(secondContext.position);
  //       expect(rec.get("city")).toBe(secondContext.city_name);
  //     } else {
  //       const { records } = await withReadSession(driver, (tx) =>
  //         tx.run(
  //           `MATCH (c:Context)-[:USES_SKILL]->(s:Skill)
  //            WHERE c.context_id = $id
  //            RETURN s.name ORDER BY s.name`,
  //           { id: contextId }
  //         )
  //       );
  //       const names = records.map((r) => r.get("s.name"));
  //       const expected = secondContext.skills.map((s: any) => s.name);
  //       expect(names).toEqual(expect.arrayContaining(expected));
  //     }
  //   }

  //   test("updates existing context properties", async () => {
  //     await updateAndAssert("properties");
  //   });

  //   test("updates existing context skills relationships", async () => {
  //     await updateAndAssert("skills");
  //   });

  //   test("creates temporal links between contexts", async () => {
  //     const testData = loadTestData("USER_001");
  //     const firstContext = testData.contexts[0]!;
  //     const secondContext = testData.contexts[1]!;
  //     // НЕ генерируем contextId здесь - PersistenceManager сделает это сам

  //     // Устанавливаем связь между контекстами
  //     secondContext.previous_context_id = firstContext.context_id;

  //     // Создаем первый контекст
  //     const result1 = await persistenceManager.upsertContexts({
  //       user_id: testData.user_id,
  //       contexts: [firstContext],
  //     });
  //     expect(result1.success).toBe(true);

  //     // Получаем context_id из firstContext после upsert
  //     const firstContextId = firstContext.context_id;
  //     expect(firstContextId).toBeDefined();

  //     // Обновляем secondContext с правильным previous_context_id
  //     secondContext.previous_context_id = firstContextId;

  //     // Создаем второй контекст с ссылкой на первый
  //     // CREATE_CONTEXT автоматически обновит первый контекст
  //     const result2 = await persistenceManager.upsertContexts({
  //       user_id: testData.user_id,
  //       contexts: [secondContext],
  //     });
  //     expect(result2.success).toBe(true);

  //     // Получаем context_id из secondContext после upsert
  //     const secondContextId = secondContext.context_id;
  //     expect(secondContextId).toBeDefined();

  //     // Проверяем что создана связь NEXT_CONTEXT
  //     const result = await withReadSession(driver, async (tx) => {
  //       return tx.run(
  //         `MATCH (prev:Context {context_id: $prev_id})-[:NEXT_CONTEXT]->(next:Context {context_id: $next_id})
  //        RETURN prev, next`,
  //         { prev_id: firstContextId, next_id: secondContextId }
  //       );
  //     });
  //     expect(result.records).toHaveLength(1);

  //     // Проверяем что свойства установлены
  //     const prevResult = await withReadSession(driver, async (tx) => {
  //       return tx.run(
  //         `MATCH (c:Context {context_id: $context_id}) RETURN c.next_context_id`,
  //         { context_id: firstContextId }
  //       );
  //     });
  //     expect(prevResult.records[0]!.get("c.next_context_id")).toBe(
  //       secondContextId
  //     );

  //     const nextResult = await withReadSession(driver, async (tx) => {
  //       return tx.run(
  //         `MATCH (c:Context {context_id: $context_id}) RETURN c.previous_context_id`,
  //         { context_id: secondContextId }
  //       );
  //     });
  //     expect(nextResult.records[0]!.get("c.previous_context_id")).toBe(
  //       firstContextId
  //     );
  //   });

  //   describe("Upserts.CREATE_TRAIL", () => {
  //     test("creates trail with user relationship", async () => {
  //       // Create two contexts first
  //       const { userId, contextId: fromContextId } = await upsertContext(
  //         driver,
  //         persistenceManager,
  //         "USER_002",
  //         0
  //       );
  //       const { contextId: toContextId } = await upsertContext(
  //         driver,
  //         persistenceManager,
  //         "USER_002",
  //         1
  //       );

  //       // Load trail data and update context IDs
  //       const testData = loadTestData("USER_002");
  //       const trailData = { ...testData.trails[0]! };
  //       trailData.from_context_id = fromContextId;
  //       trailData.to_context_id = toContextId;

  //       // Create trail
  //       const result = await persistenceManager.upsertTrails({
  //         user_id: userId,
  //         trails: [trailData],
  //       });
  //       expect(result.success).toBe(true);
  //       expect(result.trailIds).toHaveLength(1);
  //       const trailId = result.trailIds[0]!;
  //       expectTrailId(trailId);

  //       // Verify trail exists and has correct properties
  //       const trailCheck = await withReadSession(driver, (tx) =>
  //         tx.run(
  //           `MATCH (u:User {user_id: $userId})-[:HAS_TRAIL]->(t:Trail {trail_id: $trailId})
  //            RETURN t.skill, t.platform`,
  //           { userId, trailId }
  //         )
  //       );
  //       expect(trailCheck.records).toHaveLength(1);
  //       expect(trailCheck.records[0]!.get("t.skill")).toBe(trailData.skill);
  //       expect(trailCheck.records[0]!.get("t.platform")).toBe(
  //         trailData.platform
  //       );

  //       // Verify exact trail count
  //       await expectNodeCount(driver, "Trail", 1);
  //     });
  //   });

  //   describe("Negative cases", () => {
  //     test("empty contexts array throws validation error", async () => {
  //       // Test Zod schema validation directly
  //       const { UserIdContextSchema } = await import(
  //         "../../src/schemas-zod.js"
  //       );
  //       expect(() => {
  //         UserIdContextSchema.parse({
  //           user_id: "usr_test123",
  //           contexts: [],
  //         });
  //       }).toThrow();
  //     });

  //     test("idempotent upsert does not duplicate nodes", async () => {
  //       const { userId, context } = await upsertContext(
  //         driver,
  //         persistenceManager,
  //         "USER_001",
  //         0
  //       );

  //       // Count nodes after first insert
  //       const { records: beforeRecords } = await withReadSession(driver, (tx) =>
  //         tx.run(
  //           `MATCH (n)
  //            WHERE n:WorkDomain OR n:Skill OR n:Country OR n:City
  //            RETURN count(n) AS total`
  //         )
  //       );
  //       const beforeCount = beforeRecords[0]?.get("total") ?? 0;

  //       // Upsert same context again
  //       await persistenceManager.upsertContexts({
  //         user_id: userId,
  //         contexts: [context],
  //       });

  //       // Count nodes after second insert
  //       const { records: afterRecords } = await withReadSession(driver, (tx) =>
  //         tx.run(
  //           `MATCH (n)
  //            WHERE n:WorkDomain OR n:Skill OR n:Country OR n:City
  //            RETURN count(n) AS total`
  //         )
  //       );
  //       const afterCount = afterRecords[0]?.get("total") ?? 0;

  //       // Counts should be identical (no duplicates)
  //       expect(afterCount).toBe(beforeCount);
  //     });
  //   });
  // });
});
