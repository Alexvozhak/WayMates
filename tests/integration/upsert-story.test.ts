import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { Upserts } from "../../src/cypher/api.js";

import type { Driver, Session } from "neo4j-driver";
import { loadTestData } from "../helpers/test-data-loader.js";

// Импортируем генератор ID из upsert-story
import { generateContextId } from "../../src/upsert-story.js";
import {
  setupIntegrationTest,
  teardownIntegrationTest,
} from "../helpers/database-setup.js";

describe("Cypher Queries Integration Tests", () => {
  let driver: Driver;
  let session: Session;

  beforeEach(async () => {
    ({ driver, session } = await setupIntegrationTest());
  });

  afterEach(async () => {
    await teardownIntegrationTest(session, driver);
  });

  describe("Upserts.CREATE_CONTEXT", () => {
    test("creates user and context with basic properties", async () => {
      const testData = loadTestData("USER_001");
      const firstContext = testData.contexts[0]!;
      const contextId = generateContextId();
      firstContext.context_id = contextId;

      const result = await session.run(Upserts.CREATE_CONTEXT, {
        user_id: testData.user_id,
        context: firstContext,
      });

      // Проверяем что Context создан
      expect(result.records[0]!.get("context_id")).toBe(contextId);

      // Проверяем что User создан
      const userCheck = await session.run(
        "MATCH (u:User {user_id: $user_id}) RETURN u.birth_year",
        { user_id: testData.user_id }
      );
      expect(userCheck.records[0]!.get("u.birth_year")).toBe(
        firstContext.birth_year
      );

      // Проверяем связь HAS_CONTEXT
      const relationCheck = await session.run(
        "MATCH (u:User)-[r:HAS_CONTEXT]->(c:Context) WHERE u.user_id = $user_id RETURN r.is_current",
        { user_id: testData.user_id }
      );
      expect(relationCheck.records[0]!.get("r.is_current")).toBe(true);
    });

    test("duplicates context fields as properties for fast search", async () => {
      const testData = loadTestData("USER_001");
      const firstContext = testData.contexts[0]!;
      const contextId = generateContextId();
      firstContext.context_id = contextId;

      await session.run(Upserts.CREATE_CONTEXT, {
        user_id: testData.user_id,
        context: firstContext,
      });

      // Проверяем дублированные поля для быстрого поиска
      const contextResult = await session.run(
        `MATCH (c:Context {context_id: $context_id}) RETURN c`,
        { context_id: contextId }
      );
      const context = contextResult.records[0]!.get("c").properties;

      // Проверяем все дублированные поля для быстрого поиска
      expect(context.position).toBe(firstContext.position);
      expect(context.industry).toBe(firstContext.industry);
      expect(context.country_code).toBe(firstContext.country_code);
      expect(context.city_name).toBe(firstContext.city_name);
      expect(context.work_type).toBe(firstContext.work_type);
      expect(context.company_size).toBe(firstContext.company_size);
      expect(context.team_size).toBe(firstContext.team_size);
      expect(context.domains).toEqual(firstContext.domains);
      expect(context.skills).toEqual(
        firstContext.skills.map((s: any) => s.name)
      );
      expect(context.citizenships).toEqual(firstContext.citizenships);
      expect(context.creation_reason).toEqual(firstContext.creation_reason);
      expect(context.created_at).toBeDefined();
    });

    test("creates position relationship", async () => {
      const testData = loadTestData("USER_006");
      const contextWithSkills = testData.contexts[1]!;
      const contextId = generateContextId();
      contextWithSkills.context_id = contextId;

      await session.run(Upserts.CREATE_CONTEXT, {
        user_id: testData.user_id,
        context: contextWithSkills,
      });

      // Проверяем связь HAS_POSITION
      const positionCheck = await session.run(
        `MATCH (c:Context)-[:HAS_POSITION]->(p:Position) 
         WHERE c.context_id = $context_id 
         RETURN p.name`,
        { context_id: contextId }
      );
      expect(positionCheck.records[0]!.get("p.name")).toBe(
        contextWithSkills.position
      );
    });

    test("creates industry relationship", async () => {
      const testData = loadTestData("USER_006");
      const contextWithSkills = testData.contexts[1]!;
      const contextId = generateContextId();
      contextWithSkills.context_id = contextId;

      await session.run(Upserts.CREATE_CONTEXT, {
        user_id: testData.user_id,
        context: contextWithSkills,
      });

      // Проверяем связь IN_INDUSTRY
      const industryCheck = await session.run(
        `MATCH (c:Context)-[:IN_INDUSTRY]->(i:Industry)
         WHERE c.context_id = $context_id
         RETURN i.name`,
        { context_id: contextId }
      );
      expect(industryCheck.records[0]!.get("i.name")).toBe(
        contextWithSkills.industry
      );
    });

    test("creates graph relationships for skills and categories", async () => {
      const testData = loadTestData("USER_006");
      const contextWithSkills = testData.contexts[1]!;
      const contextId = generateContextId();
      contextWithSkills.context_id = contextId;

      await session.run(Upserts.CREATE_CONTEXT, {
        user_id: testData.user_id,
        context: contextWithSkills,
      });

      // Проверяем связи USES_SKILL и IN_CATEGORY
      const skillsCheck = await session.run(
        `MATCH (c:Context)-[:USES_SKILL]->(s:Skill)-[:IN_CATEGORY]->(sc:SkillCategory)
         WHERE c.context_id = $context_id
         RETURN s.name, sc.name ORDER BY s.name`,
        { context_id: contextId }
      );

      expect(skillsCheck.records.length).toBeGreaterThan(0);
      const skillNames = skillsCheck.records.map((r) => r.get("s.name"));
      const expectedSkills = contextWithSkills.skills.map((s: any) => s.name);
      expect(skillNames).toEqual(expect.arrayContaining(expectedSkills));
    });

    test("creates work domain relationships", async () => {
      const testData = loadTestData("USER_006");
      const contextWithSkills = testData.contexts[1]!;
      const contextId = generateContextId();
      contextWithSkills.context_id = contextId;

      await session.run(Upserts.CREATE_CONTEXT, {
        user_id: testData.user_id,
        context: contextWithSkills,
      });

      // Проверяем связи IN_WORK_DOMAIN
      const domainsCheck = await session.run(
        `MATCH (c:Context)-[:IN_WORK_DOMAIN]->(wd:WorkDomain)
         WHERE c.context_id = $context_id
         RETURN wd.name ORDER BY wd.name`,
        { context_id: contextId }
      );

      expect(domainsCheck.records.length).toBeGreaterThan(0);
      const domainNames = domainsCheck.records.map((r) => r.get("wd.name"));
      expect(domainNames).toEqual(
        expect.arrayContaining(contextWithSkills.domains)
      );
    });

    test("creates location relationships", async () => {
      const testData = loadTestData("USER_006");
      const contextWithSkills = testData.contexts[1]!;
      const contextId = generateContextId();
      contextWithSkills.context_id = contextId;

      await session.run(Upserts.CREATE_CONTEXT, {
        user_id: testData.user_id,
        context: contextWithSkills,
      });

      // Проверяем связи IN_CITY и IN_COUNTRY
      const locationCheck = await session.run(
        `MATCH (c:Context)-[:IN_CITY]->(city:City)-[:IN_COUNTRY]->(country:Country)
         WHERE c.context_id = $context_id
         RETURN city.name, country.name`,
        { context_id: contextId }
      );

      expect(locationCheck.records).toHaveLength(1);
      expect(locationCheck.records[0]!.get("city.name")).toBe(
        contextWithSkills.city_name
      );
      expect(locationCheck.records[0]!.get("country.name")).toBe(
        contextWithSkills.country_code
      );
    });

    test("creates citizenship relationships", async () => {
      const testData = loadTestData("USER_006");
      const contextWithSkills = testData.contexts[1]!;
      const contextId = generateContextId();
      contextWithSkills.context_id = contextId;

      await session.run(Upserts.CREATE_CONTEXT, {
        user_id: testData.user_id,
        context: contextWithSkills,
      });

      // Проверяем связи CITIZEN_OF (от Context, не от User)
      const citizenshipCheck = await session.run(
        `MATCH (u:User)-[:HAS_CONTEXT]->(c:Context)-[:CITIZEN_OF]->(ct:Country)
         WHERE u.user_id = $user_id
         RETURN ct.name ORDER BY ct.name`,
        { user_id: testData.user_id }
      );

      expect(citizenshipCheck.records).toHaveLength(
        contextWithSkills.citizenships.length
      );
      const citizenshipNames = citizenshipCheck.records.map((r) =>
        r.get("ct.name")
      );
      expect(citizenshipNames).toEqual(
        expect.arrayContaining(contextWithSkills.citizenships)
      );
    });

    test("updates existing context properties", async () => {
      const testData = loadTestData("USER_005");
      const firstContext = testData.contexts[0]!;
      const secondContext = testData.contexts[1]!;
      const contextId = generateContextId();
      firstContext.context_id = contextId;

      // Создаем контекст
      await session.run(Upserts.CREATE_CONTEXT, {
        user_id: testData.user_id,
        context: firstContext,
      });

      // Обновляем контекст с новыми данными
      const updatedContext = {
        ...firstContext,
        industry: secondContext.industry,
        position: secondContext.position,
        city_name: secondContext.city_name,
      };
      await session.run(Upserts.CREATE_CONTEXT, {
        user_id: testData.user_id,
        context: updatedContext,
      });

      // Проверяем что свойства обновились
      const contextResult = await session.run(
        "MATCH (c:Context {context_id: $context_id}) RETURN c.industry, c.position, c.city_name",
        { context_id: contextId }
      );
      const context = contextResult.records[0]!;
      expect(context.get("c.industry")).toBe(secondContext.industry);
      expect(context.get("c.position")).toBe(secondContext.position);
      expect(context.get("c.city_name")).toBe(secondContext.city_name);
    });

    test("updates existing context skills relationships", async () => {
      const testData = loadTestData("USER_005");
      const firstContext = testData.contexts[0]!;
      const secondContext = testData.contexts[1]!;
      const contextId = generateContextId();
      firstContext.context_id = contextId;

      // Создаем контекст
      await session.run(Upserts.CREATE_CONTEXT, {
        user_id: testData.user_id,
        context: firstContext,
      });

      // Обновляем контекст с новыми skills
      const updatedContext = {
        ...firstContext,
        skills: secondContext.skills,
      };
      await session.run(Upserts.CREATE_CONTEXT, {
        user_id: testData.user_id,
        context: updatedContext,
      });

      // Проверяем что skills обновились
      const skillsResult = await session.run(
        `MATCH (c:Context)-[:USES_SKILL]->(s:Skill)
         WHERE c.context_id = $context_id
         RETURN s.name ORDER BY s.name`,
        { context_id: contextId }
      );
      const skillNames = skillsResult.records.map((r) => r.get("s.name"));
      const expectedSkills = secondContext.skills.map((s: any) => s.name);
      expect(skillNames).toEqual(expect.arrayContaining(expectedSkills));
    });

    test("creates temporal links between contexts", async () => {
      const testData = loadTestData("USER_001");
      const firstContext = testData.contexts[0]!;
      const secondContext = testData.contexts[1]!;
      const firstContextId = generateContextId();
      const secondContextId = generateContextId();

      firstContext.context_id = firstContextId;
      secondContext.context_id = secondContextId;
      secondContext.previous_context_id = firstContextId;

      // Создаем первый контекст
      await session.run(Upserts.CREATE_CONTEXT, {
        user_id: testData.user_id,
        context: firstContext,
      });

      // Создаем второй контекст с ссылкой на первый
      // CREATE_CONTEXT автоматически обновит первый контекст
      await session.run(Upserts.CREATE_CONTEXT, {
        user_id: testData.user_id,
        context: secondContext,
      });

      // Проверяем что создана связь NEXT_CONTEXT
      const result = await session.run(
        `MATCH (prev:Context {context_id: $prev_id})-[:NEXT_CONTEXT]->(next:Context {context_id: $next_id})
         RETURN prev, next`,
        { prev_id: firstContextId, next_id: secondContextId }
      );
      expect(result.records).toHaveLength(1);

      // Проверяем что свойства установлены
      const prevResult = await session.run(
        `MATCH (c:Context {context_id: $context_id}) RETURN c.next_context_id`,
        { context_id: firstContextId }
      );
      expect(prevResult.records[0]!.get("c.next_context_id")).toBe(
        secondContextId
      );

      const nextResult = await session.run(
        `MATCH (c:Context {context_id: $context_id}) RETURN c.previous_context_id`,
        { context_id: secondContextId }
      );
      expect(nextResult.records[0]!.get("c.previous_context_id")).toBe(
        firstContextId
      );
    });
  });

  describe("Upserts.CREATE_TRAIL", () => {
    test("creates trail with user relationship", async () => {
      const testData = loadTestData("USER_005");
      const firstContext = testData.contexts[0]!;
      const secondContext = testData.contexts[1]!;
      const trailData = testData.trails[0]!;
      const firstContextId = generateContextId();
      const secondContextId = generateContextId();

      // Create user and contexts first
      await session.run(Upserts.CREATE_CONTEXT, {
        user_id: testData.user_id,
        context: firstContext,
      });

      await session.run(Upserts.CREATE_CONTEXT, {
        user_id: testData.user_id,
        context: secondContext,
      });

      // Create trail with direct user relationship
      const result = await session.run(Upserts.CREATE_TRAIL, {
        trail_id: "trl_test_trail_relation",
        trail: trailData,
        from_context_id: firstContextId,
        to_context_id: secondContextId,
        user_id: testData.user_id,
      });

      const createdTrailId = result.records[0]?.get("trail_id");

      // Check direct User-Trail relationship
      const userTrailCheck = await session.run(
        `MATCH (u:User)-[:HAS_TRAIL]->(t:Trail)
         WHERE u.user_id = $user_id AND t.trail_id = $trail_id
         RETURN t.trail_id, t.skill, t.platform`,
        {
          user_id: testData.user_id,
          trail_id: createdTrailId,
        }
      );

      expect(userTrailCheck.records).toHaveLength(1);
      expect(userTrailCheck.records[0]!.get("t.skill")).toBe(trailData.skill);
      expect(userTrailCheck.records[0]!.get("t.platform")).toBe(
        trailData.platform
      );
    });
  });
});
