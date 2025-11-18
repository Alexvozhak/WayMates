/**
 * StoryManager Integration Tests
 *
 * Tests upsertStory functionality for contexts and trails persistence.
 * Migrated from archived persistence-manager tests.
 *
 * Each test loads its own data (U1-U13) to avoid data race.
 * Tests run sequentially (singleThread: true) to prevent DB conflicts.
 */

import { describe, expect, it } from "vitest";

import { StoryManager } from "../../../src/core/story-manager.js";
import { DatabaseContext } from "../../../src/database-context.js";
import { withReadSession } from "../../../src/neo4j.js";
import { storyInputSchema } from "../../../src/shared/schemas.js";
import { type UserKey, TestDataManager } from "../../helpers/test-data-manager.js";
import { driver } from "../../helpers/drivers/story-manager-driver.js";

import type { StoryInput } from "../../../src/shared/schemas.js";

describe("StoryManager Integration Tests", () => {
  const testDataManager = new TestDataManager();

  /**
   * Helper: Upsert single context
   */
  async function upsertSingleContext(userKey: UserKey, contextIndex: number) {
    const testData = testDataManager.getStoryBy(userKey);
    const context = testData.contexts[contextIndex];
    if (!context) {
      throw new Error(`Context ${contextIndex} not found for ${String(userKey)}`);
    }

    const storyInput: StoryInput = {
      userId: testData.userId,
      contexts: [context],
      trails: [], // No trails for single context
    };

    const db = new DatabaseContext(driver);
    const storyManager = new StoryManager(db);

    await storyManager.upsertStory(storyInput);

    return { testData, context };
  }

  describe("CREATE: Basic Context Persistence", () => {
    // Business rule: User and Context nodes must be created with HAS_CONTEXT relationship.
    it("creates user and context with basic properties", async () => {
      const { testData, context } = await upsertSingleContext("U1", 0);
      const userId = testData.userId;
      const contextId = context.contextId;

      const userCheck = await withReadSession(driver, (tx) =>
        tx.run("MATCH (u:User {userId: $userId}) RETURN u", {
          userId,
        }),
      );
      expect(userCheck.records).toHaveLength(1);

      const contextCheck = await withReadSession(driver, (tx) =>
        tx.run("MATCH (c:Context {contextId: $contextId}) RETURN c.birthYear", {
          contextId,
        }),
      );
      expect(contextCheck.records).toHaveLength(1);
      expect(contextCheck.records[0]!.get("c.birthYear")).toBe(context.birthYear);

      const relationCheck = await withReadSession(driver, (tx) =>
        tx.run(
          "MATCH (u:User {userId: $userId})-[r:HAS_CONTEXT]->(c:Context {contextId: $contextId}) RETURN r",
          { userId, contextId },
        ),
      );
      expect(relationCheck.records.length).toBeGreaterThan(0);
    });

    // Business rule: Context fields must be duplicated as node properties for Cypher query performance.
    it("duplicates context fields as properties for fast search", async () => {
      const { context } = await upsertSingleContext("U2", 0);
      const contextId = context.contextId;

      const contextResult = await withReadSession(driver, async (tx) => {
        return tx.run("MATCH (c:Context {contextId: $contextId}) RETURN c", {
          contextId,
        });
      });

      expect(contextResult.records).toHaveLength(1);
      const dbProps = contextResult.records[0]!.get("c").properties;

      expect(dbProps.position).toBe(context.position);
      expect(dbProps.industry).toBe(context.industry);
      expect(dbProps.countryCode).toBe(context.countryCode);
      expect(dbProps.cityName).toBe(context.cityName);
      expect(dbProps.companySize).toBe(context.companySize);
      expect(dbProps.domains).toEqual(context.domains);
      expect(dbProps.skills).toEqual(context.skills);
      expect(dbProps.citizenships).toEqual(context.citizenships);
      expect(dbProps.creationReason).toEqual(context.creationReason);
      expect(dbProps.createdAt).toBeDefined();
    });

    it("creates position relationship", async () => {
      const { context } = await upsertSingleContext("U3", 0);
      const contextId = context.contextId;

      const positionCheck = await withReadSession(driver, (tx) =>
        tx.run(
          `MATCH (c:Context {contextId: $contextId})-[:HAS_POSITION]->(p:Position)
           RETURN p.name`,
          { contextId },
        ),
      );

      expect(positionCheck.records).toHaveLength(1);
      expect(positionCheck.records[0]!.get("p.name")).toBe(context.position);
    });

    it("creates industry relationship", async () => {
      const { context } = await upsertSingleContext("U4", 0);
      const contextId = context.contextId;

      const industryCheck = await withReadSession(driver, (tx) =>
        tx.run(
          `MATCH (c:Context {contextId: $contextId})-[:IN_INDUSTRY]->(i:Industry)
           RETURN i.name`,
          { contextId },
        ),
      );

      expect(industryCheck.records).toHaveLength(1);
      expect(industryCheck.records[0]!.get("i.name")).toBe(context.industry);
    });

    it("creates graph relationships for skills", async () => {
      const { context } = await upsertSingleContext("U5", 0);
      const contextId = context.contextId;

      const skillsCheck = await withReadSession(driver, (tx) =>
        tx.run(
          `MATCH (c:Context {contextId: $contextId})-[:USES_SKILL]->(s:Skill)
           RETURN s.name ORDER BY s.name`,
          { contextId },
        ),
      );

      const skillNames = skillsCheck.records.map((r) => r.get("s.name"));
      const expectedSkills = context.skills;

      expect(skillNames).toEqual(expect.arrayContaining(expectedSkills));
    });

    it("creates work domain relationships", async () => {
      const { context } = await upsertSingleContext("U6", 0);
      const contextId = context.contextId;

      const domainsCheck = await withReadSession(driver, (tx) =>
        tx.run(
          `MATCH (c:Context {contextId: $contextId})-[:IN_WORK_DOMAIN]->(wd:WorkDomain)
           RETURN wd.name ORDER BY wd.name`,
          { contextId },
        ),
      );

      const domainNames = domainsCheck.records.map((r) => r.get("wd.name"));
      expect(domainNames).toEqual(expect.arrayContaining(context.domains));
    });

    it("creates location relationships", async () => {
      const { context } = await upsertSingleContext("U7", 0);
      const contextId = context.contextId;

      const locationCheck = await withReadSession(driver, (tx) =>
        tx.run(
          `MATCH (c:Context {contextId: $contextId})-[:IN_CITY]->(city:City)-[:IN_COUNTRY]->(country:Country)
           RETURN city.name, country.name`,
          { contextId },
        ),
      );

      expect(locationCheck.records).toHaveLength(1);
      expect(locationCheck.records[0]!.get("city.name")).toBe(context.cityName);
      expect(locationCheck.records[0]!.get("country.name")).toBe(context.countryCode);
    });

    it("creates citizenship relationships", async () => {
      const { testData, context } = await upsertSingleContext("U8", 0);
      const userId = testData.userId;
      const contextId = context.contextId;

      const citizenshipCheck = await withReadSession(driver, (tx) =>
        tx.run(
          `MATCH (u:User {userId: $userId})-[:HAS_CONTEXT]->(c:Context {contextId: $contextId})-[:CITIZEN_OF]->(ct:Country)
           RETURN ct.name ORDER BY ct.name`,
          { userId, contextId },
        ),
      );

      const names = citizenshipCheck.records.map((r) => r.get("ct.name"));
      expect(names).toEqual(expect.arrayContaining(context.citizenships));
    });
  });

  describe("UPDATE: Context Updates", () => {
    // Business rule: Upsert must update existing context properties (industry, position, location).
    it("updates existing context properties", async () => {
      const testData = testDataManager.getStoryBy("U9");
      const firstContext = testData.contexts[0]!;
      const secondContext = testData.contexts[1]!;

      await upsertSingleContext("U9", 0);
      const contextId = firstContext.contextId;

      const updatedContext = {
        ...firstContext,
        industry: secondContext.industry,
        position: secondContext.position,
        cityName: secondContext.cityName,
      };

      const storyInput: StoryInput = {
        userId: testData.userId,
        contexts: [updatedContext],
        trails: [],
      };

      const db = new DatabaseContext(driver);
      const storyManager = new StoryManager(db);
      await storyManager.upsertStory(storyInput);

      const result = await withReadSession(driver, (tx) =>
        tx.run(
          `MATCH (c:Context {contextId: $contextId})
           RETURN c.industry AS ind, c.position AS pos, c.cityName AS city`,
          { contextId },
        ),
      );

      const rec = result.records[0]!;
      expect(rec.get("ind")).toBe(secondContext.industry);
      expect(rec.get("pos")).toBe(secondContext.position);
      expect(rec.get("city")).toBe(secondContext.cityName);
    });

    // Business rule: Upsert must replace old skill relationships with new ones (not append).
    it("updates existing context skills relationships", async () => {
      const testData = testDataManager.getStoryBy("U9");
      const firstContext = testData.contexts[0]!;
      const secondContext = testData.contexts[1]!;

      await upsertSingleContext("U9", 0);
      const contextId = firstContext.contextId;

      const updatedContext = {
        ...firstContext,
        skills: secondContext.skills,
      };

      const storyInput: StoryInput = {
        userId: testData.userId,
        contexts: [updatedContext],
        trails: [],
      };

      const db = new DatabaseContext(driver);
      const storyManager = new StoryManager(db);
      await storyManager.upsertStory(storyInput);

      const result = await withReadSession(driver, (tx) =>
        tx.run(
          `MATCH (c:Context)-[:USES_SKILL]->(s:Skill)
           WHERE c.contextId = $contextId
           RETURN s.name ORDER BY s.name`,
          { contextId },
        ),
      );

      const skillNames = result.records.map((r) => r.get("s.name"));
      expect(skillNames).toEqual(expect.arrayContaining(secondContext.skills));
    });
  });

  describe("TEMPORAL: Context Links", () => {
    // Business rule: Contexts must be linked via NEXT_CONTEXT relationship and bidirectional ID properties.
    it("creates temporal links between contexts (previousContextId/nextContextId)", async () => {
      const testData = testDataManager.getStoryBy("U9");
      const firstContext = testData.contexts[0]!;
      const secondContext = testData.contexts[1]!;

      await upsertSingleContext("U9", 0);
      const firstContextId = firstContext.contextId;

      const secondContextWithLink = {
        ...secondContext,
        previousContextId: firstContextId,
      };

      const storyInput: StoryInput = {
        userId: testData.userId,
        contexts: [secondContextWithLink],
        trails: [],
      };

      const db = new DatabaseContext(driver);
      const storyManager = new StoryManager(db);
      await storyManager.upsertStory(storyInput);

      const secondContextId = secondContext.contextId;

      const nextRelResult = await withReadSession(driver, (tx) =>
        tx.run(
          `MATCH (prev:Context {contextId: $prevId})-[:NEXT_CONTEXT]->(next:Context {contextId: $nextId})
           RETURN prev, next`,
          { prevId: firstContextId, nextId: secondContextId },
        ),
      );
      expect(nextRelResult.records).toHaveLength(1);

      const prevResult = await withReadSession(driver, (tx) =>
        tx.run(`MATCH (c:Context {contextId: $contextId}) RETURN c.nextContextId`, {
          contextId: firstContextId,
        }),
      );
      expect(prevResult.records[0]!.get("c.nextContextId")).toBe(secondContextId);

      const nextResult = await withReadSession(driver, (tx) =>
        tx.run(`MATCH (c:Context {contextId: $contextId}) RETURN c.previousContextId`, {
          contextId: secondContextId,
        }),
      );
      expect(nextResult.records[0]!.get("c.previousContextId")).toBe(firstContextId);
    });
  });

  describe("VALIDATION: Edge Cases", () => {
    // Business rule: StoryInput must have at least one context (Zod validation).
    it("empty contexts array throws validation error", () => {
      expect(() => {
        storyInputSchema.parse({
          userId: "usr_test123",
          contexts: [],
          trails: [],
        });
      }).toThrow();
    });

    // Business rule: Upsert must be idempotent - repeated calls must not duplicate reference nodes.
    it("idempotent upsert does not duplicate nodes", async () => {
      const { testData, context } = await upsertSingleContext("U1", 0);

      const beforeResult = await withReadSession(driver, (tx) =>
        tx.run(
          `MATCH (n)
           WHERE n:WorkDomain OR n:Skill OR n:Country OR n:City
           RETURN count(n) AS total`,
        ),
      );
      const beforeCount = beforeResult.records[0]!.get("total");

      const storyInput: StoryInput = {
        userId: testData.userId,
        contexts: [context],
        trails: [],
      };

      const db = new DatabaseContext(driver);
      const storyManager = new StoryManager(db);
      await storyManager.upsertStory(storyInput);

      const afterResult = await withReadSession(driver, (tx) =>
        tx.run(
          `MATCH (n)
           WHERE n:WorkDomain OR n:Skill OR n:Country OR n:City
           RETURN count(n) AS total`,
        ),
      );
      const afterCount = afterResult.records[0]!.get("total");

      expect(afterCount).toBe(beforeCount);
    });

    // Business rule: Languages array must be persisted on Context node and create SPEAKS_FLUENT relationships.
    it("SC6: persists languages field and creates SPEAKS_FLUENT relationships", async () => {
      const { context } = await upsertSingleContext("U1", 0);
      const contextId = context.contextId;

      const contextResult = await withReadSession(driver, (tx) =>
        tx.run("MATCH (c:Context {contextId: $contextId}) RETURN c.languages AS languages", {
          contextId,
        }),
      );
      expect(contextResult.records).toHaveLength(1);
      const dbLanguages = contextResult.records[0]!.get("languages");
      expect(dbLanguages).toEqual(["en"]);

      const languagesResult = await withReadSession(driver, (tx) =>
        tx.run(
          `MATCH (c:Context {contextId: $contextId})-[:SPEAKS_FLUENT]->(l:Language)
           RETURN l.code AS code, l.name AS name
           ORDER BY l.code`,
          { contextId },
        ),
      );
      expect(languagesResult.records).toHaveLength(1);
      expect(languagesResult.records[0]!.get("code")).toBe("en");
      expect(languagesResult.records[0]!.get("name")).toBe("English");

      const u4 = testDataManager.getStoryBy("U4");
      const u4Context = u4.contexts[0];
      if (!u4Context) {
        throw new Error("U4 context not found");
      }

      const u4StoryInput: StoryInput = {
        userId: u4.userId,
        contexts: [u4Context],
        trails: [],
      };

      const db = new DatabaseContext(driver);
      const storyManager = new StoryManager(db);
      await storyManager.upsertStory(u4StoryInput);

      const u4LanguagesResult = await withReadSession(driver, (tx) =>
        tx.run(
          `MATCH (c:Context {contextId: $contextId})-[:SPEAKS_FLUENT]->(l:Language)
           RETURN l.code AS code
           ORDER BY l.code`,
          { contextId: u4Context.contextId },
        ),
      );
      expect(u4LanguagesResult.records).toHaveLength(2);
      const codes = u4LanguagesResult.records.map((r) => r.get("code"));
      expect(codes).toEqual(["de", "en"]);

      const u3 = testDataManager.getStoryBy("U3");
      const u3Context = u3.contexts[0];
      if (!u3Context) {
        throw new Error("U3 context not found");
      }

      const u3StoryInput: StoryInput = {
        userId: u3.userId,
        contexts: [u3Context],
        trails: [],
      };

      await storyManager.upsertStory(u3StoryInput);

      const u3LanguagesResult = await withReadSession(driver, (tx) =>
        tx.run(
          `MATCH (c:Context {contextId: $contextId})-[:SPEAKS_FLUENT]->(l:Language)
           RETURN count(l) AS count`,
          { contextId: u3Context.contextId },
        ),
      );
      expect(Number(u3LanguagesResult.records[0]!.get("count"))).toBe(0);
    });
  });
});
