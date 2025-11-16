/**
 * StoryManager Integration Tests
 *
 * Tests upsertStory functionality for contexts and trails persistence.
 * Migrated from archived persistence-manager tests.
 *
 * Each test loads its own data (U1-U13) to avoid data race.
 * Tests run sequentially (singleThread: true) to prevent DB conflicts.
 */

import { describe, expect, test } from "vitest";

import { StoryManager } from "../../../src/core/story-manager.js";
import { DatabaseContext } from "../../../src/database-context.js";
import { withReadSession } from "../../../src/neo4j.js";
import { storyInputSchema } from "../../../src/shared/schemas.js";
import { type UserKey, TestDataManager } from "../../helpers/test-data-manager.js";

import { driver } from "./setup.js";

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
    test("creates user and context with basic properties", async () => {
      const { testData, context } = await upsertSingleContext("U1", 0);
      const userId = testData.userId;
      const contextId = context.contextId;

      // Verify user node exists
      const userCheck = await withReadSession(driver, (tx) =>
        tx.run("MATCH (u:User {userId: $userId}) RETURN u", {
          userId,
        }),
      );
      expect(userCheck.records).toHaveLength(1);

      // Verify context node exists with birthYear
      const contextCheck = await withReadSession(driver, (tx) =>
        tx.run("MATCH (c:Context {contextId: $contextId}) RETURN c.birthYear", {
          contextId,
        }),
      );
      expect(contextCheck.records).toHaveLength(1);
      expect(contextCheck.records[0]!.get("c.birthYear")).toBe(context.birthYear);

      // Verify HAS_CONTEXT relationship exists
      const relationCheck = await withReadSession(driver, (tx) =>
        tx.run(
          "MATCH (u:User {userId: $userId})-[r:HAS_CONTEXT]->(c:Context {contextId: $contextId}) RETURN r",
          { userId, contextId },
        ),
      );
      expect(relationCheck.records.length).toBeGreaterThan(0);
    });

    test("duplicates context fields as properties for fast search", async () => {
      const { context } = await upsertSingleContext("U2", 0);
      const contextId = context.contextId;

      // Verify context node properties
      const contextResult = await withReadSession(driver, async (tx) => {
        return tx.run("MATCH (c:Context {contextId: $contextId}) RETURN c", {
          contextId,
        });
      });

      expect(contextResult.records).toHaveLength(1);
      const dbProps = contextResult.records[0]!.get("c").properties;

      // Verify duplicated properties for fast search
      expect(dbProps.position).toBe(context.position);
      expect(dbProps.industry).toBe(context.industry);
      expect(dbProps.countryCode).toBe(context.countryCode);
      expect(dbProps.cityName).toBe(context.cityName);
      expect(dbProps.companySize).toBe(context.companySize);
      expect(dbProps.domains).toEqual(context.domains);
      expect(dbProps.skills).toEqual(context.skills); // skills is already string[]
      expect(dbProps.citizenships).toEqual(context.citizenships);
      expect(dbProps.creationReason).toEqual(context.creationReason);
      expect(dbProps.createdAt).toBeDefined();
    });

    test("creates position relationship", async () => {
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

    test("creates industry relationship", async () => {
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

    test("creates graph relationships for skills", async () => {
      const { context } = await upsertSingleContext("U5", 0);
      const contextId = context.contextId;

      // Note: IN_CATEGORY relationships are created by import-skills script
      // This test only verifies USES_SKILL relationships
      const skillsCheck = await withReadSession(driver, (tx) =>
        tx.run(
          `MATCH (c:Context {contextId: $contextId})-[:USES_SKILL]->(s:Skill)
           RETURN s.name ORDER BY s.name`,
          { contextId },
        ),
      );

      const skillNames = skillsCheck.records.map((r) => r.get("s.name"));
      const expectedSkills = context.skills; // skills is already string[]

      expect(skillNames).toEqual(expect.arrayContaining(expectedSkills));
    });

    test("creates work domain relationships", async () => {
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

    test("creates location relationships", async () => {
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

    test("creates citizenship relationships", async () => {
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
    test("updates existing context properties", async () => {
      // Use U9 which has 4 contexts
      const testData = testDataManager.getStoryBy("U9");
      const firstContext = testData.contexts[0]!;
      const secondContext = testData.contexts[1]!;

      // Create first context
      await upsertSingleContext("U9", 0);
      const contextId = firstContext.contextId;

      // Prepare updated context with data from second context
      const updatedContext = {
        ...firstContext,
        industry: secondContext.industry,
        position: secondContext.position,
        cityName: secondContext.cityName,
      };

      // Upsert updated context
      const storyInput: StoryInput = {
        userId: testData.userId,
        contexts: [updatedContext],
        trails: [],
      };

      const db = new DatabaseContext(driver);
      const storyManager = new StoryManager(db);
      await storyManager.upsertStory(storyInput);

      // Verify properties were updated
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

    test("updates existing context skills relationships", async () => {
      // Use U9 which has 4 contexts
      const testData = testDataManager.getStoryBy("U9");
      const firstContext = testData.contexts[0]!;
      const secondContext = testData.contexts[1]!;

      // Create first context
      await upsertSingleContext("U9", 0);
      const contextId = firstContext.contextId;

      // Prepare updated context with skills from second context
      const updatedContext = {
        ...firstContext,
        skills: secondContext.skills,
      };

      // Upsert updated context
      const storyInput: StoryInput = {
        userId: testData.userId,
        contexts: [updatedContext],
        trails: [],
      };

      const db = new DatabaseContext(driver);
      const storyManager = new StoryManager(db);
      await storyManager.upsertStory(storyInput);

      // Verify skills relationships were updated
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
    test("creates temporal links between contexts (previousContextId/nextContextId)", async () => {
      const testData = testDataManager.getStoryBy("U9");
      const firstContext = testData.contexts[0]!;
      const secondContext = testData.contexts[1]!;

      // Create first context
      await upsertSingleContext("U9", 0);
      const firstContextId = firstContext.contextId;

      // Create second context with previousContextId pointing to first
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

      // Verify NEXT_CONTEXT relationship exists
      const nextRelResult = await withReadSession(driver, (tx) =>
        tx.run(
          `MATCH (prev:Context {contextId: $prevId})-[:NEXT_CONTEXT]->(next:Context {contextId: $nextId})
           RETURN prev, next`,
          { prevId: firstContextId, nextId: secondContextId },
        ),
      );
      expect(nextRelResult.records).toHaveLength(1);

      // Verify nextContextId property on first context
      const prevResult = await withReadSession(driver, (tx) =>
        tx.run(`MATCH (c:Context {contextId: $contextId}) RETURN c.nextContextId`, {
          contextId: firstContextId,
        }),
      );
      expect(prevResult.records[0]!.get("c.nextContextId")).toBe(secondContextId);

      // Verify previousContextId property on second context
      const nextResult = await withReadSession(driver, (tx) =>
        tx.run(`MATCH (c:Context {contextId: $contextId}) RETURN c.previousContextId`, {
          contextId: secondContextId,
        }),
      );
      expect(nextResult.records[0]!.get("c.previousContextId")).toBe(firstContextId);
    });
  });

  describe("VALIDATION: Edge Cases", () => {
    test("empty contexts array throws validation error", () => {
      // Test Zod schema validation
      expect(() => {
        storyInputSchema.parse({
          userId: "usr_test123",
          contexts: [],
          trails: [],
        });
      }).toThrow();
    });

    test("idempotent upsert does not duplicate nodes", async () => {
      const { testData, context } = await upsertSingleContext("U1", 0);

      // Count nodes after first insert
      const beforeResult = await withReadSession(driver, (tx) =>
        tx.run(
          `MATCH (n)
           WHERE n:WorkDomain OR n:Skill OR n:Country OR n:City
           RETURN count(n) AS total`,
        ),
      );
      const beforeCount = beforeResult.records[0]!.get("total");

      // Upsert same context again
      const storyInput: StoryInput = {
        userId: testData.userId,
        contexts: [context],
        trails: [],
      };

      const db = new DatabaseContext(driver);
      const storyManager = new StoryManager(db);
      await storyManager.upsertStory(storyInput);

      // Count nodes after second insert
      const afterResult = await withReadSession(driver, (tx) =>
        tx.run(
          `MATCH (n)
           WHERE n:WorkDomain OR n:Skill OR n:Country OR n:City
           RETURN count(n) AS total`,
        ),
      );
      const afterCount = afterResult.records[0]!.get("total");

      // Should be same count (no duplicates)
      expect(afterCount).toBe(beforeCount);
    });

    test("SC6: persists languages field and creates SPEAKS_FLUENT relationships", async () => {
      const { context } = await upsertSingleContext("U1", 0);
      const contextId = context.contextId;

      // Verify languages array is stored on Context node
      const contextResult = await withReadSession(driver, (tx) =>
        tx.run("MATCH (c:Context {contextId: $contextId}) RETURN c.languages AS languages", {
          contextId,
        }),
      );
      expect(contextResult.records).toHaveLength(1);
      const dbLanguages = contextResult.records[0]!.get("languages");
      expect(dbLanguages).toEqual(["en"]); // U1 has languages: ["en"]

      // Verify Language nodes exist and SPEAKS_FLUENT relationships created
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

      // Test multiple languages (U4 has ["en", "de"])
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

      // Verify multiple languages
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
      expect(codes).toEqual(["de", "en"]); // Sorted alphabetically

      // Verify null languages (U3 has no languages field)
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

      // Verify no SPEAKS_FLUENT relationships for null languages
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
