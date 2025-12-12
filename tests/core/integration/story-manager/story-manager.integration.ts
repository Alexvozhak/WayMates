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

import { StoryManager } from "../../../../src/core/story-manager.js";
import { DatabaseContext } from "../../../../src/core/database-context.js";
import { withReadSession, withWriteSession } from "../../../../src/core/neo4j.js";
import { storyInputSchema } from "../../../../src/shared/schemas.js";
import { type UserKey, UserStories } from "../../helpers/user-stories.js";
import { driver } from "../../helpers/drivers/story-manager-driver.js";

import type { StoryInput } from "../../../../src/shared/schemas.js";

/**
 * Helper: Create StoryManager instance
 */
function createStoryManager(): StoryManager {
  const db = new DatabaseContext(driver);
  return new StoryManager(db);
}

describe("StoryManager Integration Tests", () => {
  const testDataManager = new UserStories();

  /**
   * Helper: Load full story with trails
   */
  async function loadStoryWithTrails(userKey: UserKey) {
    const testData = testDataManager.getStoryBy(userKey);
    const storyManager = createStoryManager();
    await storyManager.upsertStory(testData);
    return { testData, storyManager };
  }

  /**
   * Helper: Upsert single context
   */
  async function upsertSingleContext(userKey: UserKey, contextIndex: number) {
    const testData = testDataManager.getStoryBy(userKey);
    const context = testData.contexts[contextIndex];
    if (!context) {
      throw new Error(`Context ${contextIndex} not found for ${String(userKey)}`);
    }

    // When loading single context, it must be current (nextContextId = null)
    // Otherwise updateContext tests will fail (they require current context)
    const currentContext = {
      ...context,
      nextContextId: null,
    };

    const storyInput: StoryInput = {
      userId: testData.userId,
      contexts: [currentContext],
      trails: [], // No trails for single context
    };

    const storyManager = createStoryManager();

    await storyManager.upsertStory(storyInput);

    return { testData, context: currentContext };
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
        tx.run("MATCH (u:User {userId: $userId})-[r:HAS_CONTEXT]->(c:Context {contextId: $contextId}) RETURN r", {
          userId,
          contextId,
        }),
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
           RETURN p.canonicalName`,
          { contextId },
        ),
      );

      expect(positionCheck.records).toHaveLength(1);
      expect(positionCheck.records[0]!.get("p.canonicalName")).toBe(context.position);
    });

    it("creates industry relationship", async () => {
      const { context } = await upsertSingleContext("U4", 0);
      const contextId = context.contextId;

      const industryCheck = await withReadSession(driver, (tx) =>
        tx.run(
          `MATCH (c:Context {contextId: $contextId})-[:IN_INDUSTRY]->(i:Industry)
           RETURN i.canonicalName`,
          { contextId },
        ),
      );

      expect(industryCheck.records).toHaveLength(1);
      expect(industryCheck.records[0]!.get("i.canonicalName")).toBe(context.industry);
    });

    it("creates graph relationships for skills", async () => {
      const { context } = await upsertSingleContext("U5", 0);
      const contextId = context.contextId;

      const skillsCheck = await withReadSession(driver, (tx) =>
        tx.run(
          `MATCH (c:Context {contextId: $contextId})-[:USES_SKILL]->(s:Skill)
           RETURN s.canonicalName ORDER BY s.canonicalName`,
          { contextId },
        ),
      );

      const skillNames = skillsCheck.records.map((r) => r.get("s.canonicalName"));
      const expectedSkills = context.skills;

      expect(skillNames).toEqual(expect.arrayContaining(expectedSkills));
    });

    // Business rule: Skills imported from YAML must have complexity property (ADR-009).
    // Import script validates range 0-100 via Zod before writing to DB.
    it("imported skills have complexity property", async () => {
      const skillCheck = await withReadSession(driver, (tx) =>
        tx.run(
          `MATCH (s:Skill)
           WHERE s.complexity IS NOT NULL
           RETURN count(s) AS count`,
        ),
      );

      const count = Number(skillCheck.records[0]!.get("count"));

      expect(count).toBeGreaterThan(80);
    });

    it("creates work domain relationships", async () => {
      const { context } = await upsertSingleContext("U6", 0);
      const contextId = context.contextId;

      const domainsCheck = await withReadSession(driver, (tx) =>
        tx.run(
          `MATCH (c:Context {contextId: $contextId})-[:IN_WORK_DOMAIN]->(wd:WorkDomain)
           RETURN wd.canonicalName ORDER BY wd.canonicalName`,
          { contextId },
        ),
      );

      const domainNames = domainsCheck.records.map((r) => r.get("wd.canonicalName"));
      expect(domainNames).toEqual(expect.arrayContaining(context.domains));
    });

    it("creates location relationships", async () => {
      const { context } = await upsertSingleContext("U7", 0);
      const contextId = context.contextId;

      const locationCheck = await withReadSession(driver, (tx) =>
        tx.run(
          `MATCH (c:Context {contextId: $contextId})-[:IN_CITY]->(city:City)-[:IN_COUNTRY]->(country:Country)
           RETURN city.canonicalName, country.name`,
          { contextId },
        ),
      );

      expect(locationCheck.records).toHaveLength(1);
      expect(locationCheck.records[0]!.get("city.canonicalName")).toBe(context.cityName);
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

      const storyManager = createStoryManager();
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

      const storyManager = createStoryManager();
      await storyManager.upsertStory(storyInput);

      const result = await withReadSession(driver, (tx) =>
        tx.run(
          `MATCH (c:Context)-[:USES_SKILL]->(s:Skill)
           WHERE c.contextId = $contextId
           RETURN s.canonicalName ORDER BY s.canonicalName`,
          { contextId },
        ),
      );

      const skillNames = result.records.map((r) => r.get("s.canonicalName"));
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

      const storyManager = createStoryManager();
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

  describe("UPDATE: updateContext", () => {
    // Business rule: Only current context (nextContextId IS NULL) can be updated.
    // Ownership is implicit - user can only update their own current context.
    // Cypher MATCH: (user:User {userId})-[:HAS_CONTEXT]->(c:Context) WHERE c.nextContextId IS NULL
    it("updates user's own current context successfully", async () => {
      const { testData } = await upsertSingleContext("U1", 0);

      const storyManager = createStoryManager();

      const result = await storyManager.updateContext({
        userId: testData.userId,
        updates: { position: "Updated Position" },
      });

      expect(result.position).toBe("Updated Position");
      expect(result.contextId).toBe(testData.contexts[0]!.contextId);
    });

    // Business rule: Only current context (nextContextId IS NULL) is updated, not historical contexts.
    // Cypher query: WHERE c.nextContextId IS NULL
    it("updates only current context, not previous contexts in temporal chain", async () => {
      const testData = testDataManager.getStoryBy("U9");
      const firstContext = testData.contexts[0]!;
      const secondContext = testData.contexts[1]!;

      await upsertSingleContext("U9", 0);
      const ctx1Id = firstContext.contextId;
      const ctx1OriginalPosition = firstContext.position;

      const secondContextWithLink = {
        ...secondContext,
        previousContextId: ctx1Id,
        nextContextId: null, // Make it current context
      };

      const storyInput: StoryInput = {
        userId: testData.userId,
        contexts: [secondContextWithLink],
        trails: [],
      };

      const storyManager = createStoryManager();
      await storyManager.upsertStory(storyInput);

      const ctx2Id = secondContext.contextId;

      await storyManager.updateContext({
        userId: testData.userId,
        updates: { position: "Staff Engineer" },
      });

      const ctx2Result = await withReadSession(driver, (tx) =>
        tx.run("MATCH (c:Context {contextId: $id}) RETURN c.position", { id: ctx2Id }),
      );
      expect(ctx2Result.records[0]!.get("c.position")).toBe("Staff Engineer");

      const ctx1Result = await withReadSession(driver, (tx) =>
        tx.run("MATCH (c:Context {contextId: $id}) RETURN c.position", { id: ctx1Id }),
      );
      expect(ctx1Result.records[0]!.get("c.position")).toBe(ctx1OriginalPosition);
    });

    // Business rule: Partial update - only specified fields are updated, others remain unchanged.
    // Cypher: SET c += $updates (merge syntax preserves untouched fields)
    it("performs partial update - only specified fields change", async () => {
      const { testData, context } = await upsertSingleContext("U1", 0);
      const originalContext = context;

      const storyManager = createStoryManager();

      await storyManager.updateContext({
        userId: testData.userId,
        updates: {
          position: "Tech Lead",
          skills: ["TypeScript", "Leadership"],
        },
      });

      const result = await withReadSession(driver, (tx) =>
        tx.run("MATCH (c:Context {contextId: $id}) RETURN c", {
          id: originalContext.contextId,
        }),
      );

      const props = result.records[0]!.get("c").properties;

      expect(props.position).toBe("Tech Lead");
      expect(props.skills).toEqual(["TypeScript", "Leadership"]);

      expect(props.industry).toBe(originalContext.industry);
      expect(props.domains).toEqual(originalContext.domains);
      expect(props.countryCode).toBe(originalContext.countryCode);
      expect(props.cityName).toBe(originalContext.cityName);
      expect(props.birthYear).toBe(originalContext.birthYear);
      expect(props.companySize).toBe(originalContext.companySize);
      expect(props.citizenships).toEqual(originalContext.citizenships);
      expect(props.educationLevel).toBe(originalContext.educationLevel);
      expect(props.salaryExact).toBe(originalContext.salaryExact);
      expect(props.salaryMin).toBe(originalContext.salaryMin);
      expect(props.salaryMax).toBe(originalContext.salaryMax);
      expect(props.languages).toEqual(originalContext.languages);
      expect(props.creationReason).toEqual(originalContext.creationReason);
    });

    // Business rule: UPDATE_CONTEXT_QUERY map projection must return ALL fields from schema.
    // This validates schema-Cypher contract: adding fields to updateContextInputSchema requires updating Cypher.
    it("returns all updatable fields from Cypher map projection", async () => {
      const { testData } = await upsertSingleContext("U1", 0);

      const storyManager = createStoryManager();

      const result = await storyManager.updateContext({
        userId: testData.userId,
        updates: { position: "Test Position" },
      });

      const requiredFields = [
        "contextId",
        "previousContextId",
        "nextContextId",
        "createdAt",
        "creationReason",
        "position",
        "domains",
        "skills",
        "industry",
        "companySize",
        "countryCode",
        "cityName",
        "citizenships",
        "birthYear",
        "educationLevel",
        "salaryExact",
        "salaryMin",
        "salaryMax",
        "languages",
        "feedback",
      ];

      for (const field of requiredFields) {
        expect(result).toHaveProperty(field);
      }
    });

    // Edge case: User without contexts should return clear error.
    // Cypher returns 0 records when no HAS_CONTEXT relationship exists.
    it("returns error when user has no contexts", async () => {
      const orphanUserId = "usr_019a6ea7-0000-7000-0000-000000000000";

      await withWriteSession(driver, (tx) => tx.run("MERGE (u:User {userId: $userId})", { userId: orphanUserId }));

      const storyManager = createStoryManager();

      const promise = storyManager.updateContext({
        userId: orphanUserId,
        updates: { position: "Any" },
      });

      await expect(promise).rejects.toThrow(
        `Current context not found for user ${orphanUserId} or user has no contexts`,
      );
    });

    // Business rule: feedback field stores user's personal reflection (max 200 chars).
    // Use case: User adds emotional context to career transition.
    it("persists and retrieves feedback field", async () => {
      const { testData } = await upsertSingleContext("U1", 0);

      const storyManager = createStoryManager();

      const feedbackText = "Great learning experience, but challenging work-life balance";

      const result = await storyManager.updateContext({
        userId: testData.userId,
        updates: { feedback: feedbackText },
      });

      expect(result.feedback).toBe(feedbackText);

      const dbResult = await withReadSession(driver, (tx) =>
        tx.run("MATCH (c:Context {contextId: $id}) RETURN c.feedback", {
          id: testData.contexts[0]!.contextId,
        }),
      );
      expect(dbResult.records[0]!.get("c.feedback")).toBe(feedbackText);
    });

    // Business rule: updatedAt timestamp is automatically set on update (audit trail).
    // Cypher: SET c.updatedAt = timestamp()
    it("updatedAt increases with each update", async () => {
      const { testData, context } = await upsertSingleContext("U1", 0);
      const contextId = context.contextId;

      const storyManager = createStoryManager();

      await storyManager.updateContext({
        userId: testData.userId,
        updates: { position: "Position 1" },
      });

      const result1 = await withReadSession(driver, (tx) =>
        tx.run("MATCH (c:Context {contextId: $id}) RETURN c.updatedAt", { id: contextId }),
      );
      const updatedAt1 = Number(result1.records[0]!.get("c.updatedAt"));

      await storyManager.updateContext({
        userId: testData.userId,
        updates: { position: "Position 2" },
      });

      const result2 = await withReadSession(driver, (tx) =>
        tx.run("MATCH (c:Context {contextId: $id}) RETURN c.updatedAt", { id: contextId }),
      );
      const updatedAt2 = Number(result2.records[0]!.get("c.updatedAt"));

      expect(updatedAt2).toBeGreaterThan(updatedAt1);
    });
  });

  describe("DELETE: deleteStory", () => {
    // Business rule: Test cleanup must completely remove user's career history (contexts + trails + user node).
    // Use case: afterAll cleanup in cold-start tests (ADR-008).
    it("removes all contexts, trails, and user node for complete cleanup", async () => {
      const testData = testDataManager.getStoryBy("U10"); // 3 contexts, 2 trails
      const userId = testData.userId;

      const storyManager = createStoryManager();
      await storyManager.upsertStory(testData);

      // Verify data exists before delete
      const beforeStory = await storyManager.getUserStory(userId);
      expect(beforeStory.contexts).toHaveLength(3);
      expect(beforeStory.trails).toHaveLength(2);

      // Delete entire story
      const result = await storyManager.deleteStory(userId);

      expect(result.deletedContexts).toBe(3);
      expect(result.deletedTrails).toBe(2);

      // Verify complete cleanup: no contexts, no trails, no user node
      const afterStory = await storyManager.getUserStory(userId);
      expect(afterStory.contexts).toHaveLength(0);
      expect(afterStory.trails).toHaveLength(0);

      const userCheck = await withReadSession(driver, (tx) =>
        tx.run("MATCH (u:User {userId: $userId}) RETURN u", { userId }),
      );
      expect(userCheck.records).toHaveLength(0);
    });

    // Business rule: deleteStory must be idempotent - repeated calls must not throw errors.
    // Use case: Test frameworks may call cleanup multiple times (beforeEach + afterAll).
    it("idempotent: repeated delete returns zero counts without error", async () => {
      const testData = testDataManager.getStoryBy("U12"); // 4 contexts, 3 trails
      const userId = testData.userId;

      const storyManager = createStoryManager();
      await storyManager.upsertStory(testData);

      // First delete
      const firstResult = await storyManager.deleteStory(userId);
      expect(firstResult.deletedContexts).toBe(4);
      expect(firstResult.deletedTrails).toBe(3);

      // Second delete (idempotent)
      const secondResult = await storyManager.deleteStory(userId);
      expect(secondResult.deletedContexts).toBe(0);
      expect(secondResult.deletedTrails).toBe(0);

      // Third delete (still safe)
      const thirdResult = await storyManager.deleteStory(userId);
      expect(thirdResult.deletedContexts).toBe(0);
      expect(thirdResult.deletedTrails).toBe(0);
    });

    // Business rule: deleteStory must not affect other users' data (isolation).
    // Use case: Parallel test execution with shared database must be safe.
    it("isolated: deleting one user does not affect other users", async () => {
      const u10Data = testDataManager.getStoryBy("U10"); // 3 contexts, 2 trails
      const u12Data = testDataManager.getStoryBy("U12"); // 4 contexts, 3 trails

      const storyManager = createStoryManager();
      await storyManager.upsertStory(u10Data);
      await storyManager.upsertStory(u12Data);

      // Delete only U10
      await storyManager.deleteStory(u10Data.userId);

      // U12 must remain intact
      const u12Story = await storyManager.getUserStory(u12Data.userId);
      expect(u12Story.contexts).toHaveLength(4);
      expect(u12Story.trails).toHaveLength(3);

      // U10 must be gone
      const u10Story = await storyManager.getUserStory(u10Data.userId);
      expect(u10Story.contexts).toHaveLength(0);
      expect(u10Story.trails).toHaveLength(0);
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

      const storyManager = createStoryManager();
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
           RETURN l.code AS code, l.canonicalName AS canonicalName
           ORDER BY l.code`,
          { contextId },
        ),
      );
      expect(languagesResult.records).toHaveLength(1);
      expect(languagesResult.records[0]!.get("code")).toBe("en");
      expect(languagesResult.records[0]!.get("canonicalName")).toBe("English");

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

      const storyManager = createStoryManager();
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

  describe("TRAILS: Trail Persistence", () => {
    /**
     * Тропа может вести к первому контексту пользователя (fromContextId = null).
     * Сценарий: пользователь добавляет курс, который прошёл до начала карьеры.
     * Баг: старый код делал MERGE на null contextId, создавая мусорный узел.
     */
    it("TC-TR1: creates trail with fromContextId = null (leads to first context)", async () => {
      const { testData } = await loadStoryWithTrails("U13");
      const userId = testData.userId;
      const trail = testData.trails[0]!;

      const trailCheck = await withReadSession(driver, (tx) =>
        tx.run(
          `MATCH (t:Trail {trailId: $trailId})
           RETURN t.skill AS skill, t.fromContextId AS fromCtx, t.toContextId AS toCtx`,
          { trailId: trail.trailId },
        ),
      );
      expect(trailCheck.records).toHaveLength(1);
      expect(trailCheck.records[0]!.get("skill")).toBe("python");
      expect(trailCheck.records[0]!.get("fromCtx")).toBeNull();
      expect(trailCheck.records[0]!.get("toCtx")).toBe(trail.toContextId);

      // Нет STEPS_ON связи (fromContextId = null)
      const stepsOnCheck = await withReadSession(driver, (tx) =>
        tx.run(
          `MATCH (c:Context)-[:STEPS_ON]->(t:Trail {trailId: $trailId})
           RETURN count(c) AS count`,
          { trailId: trail.trailId },
        ),
      );
      expect(Number(stepsOnCheck.records[0]!.get("count"))).toBe(0);

      // STEPS_TO связь существует
      const stepsToCheck = await withReadSession(driver, (tx) =>
        tx.run(
          `MATCH (t:Trail {trailId: $trailId})-[:STEPS_TO]->(c:Context {contextId: $contextId})
           RETURN count(*) AS count`,
          { trailId: trail.trailId, contextId: trail.toContextId },
        ),
      );
      expect(Number(stepsToCheck.records[0]!.get("count"))).toBe(1);

      // HAS_TRAIL связь с пользователем
      const hasTrailCheck = await withReadSession(driver, (tx) =>
        tx.run(
          `MATCH (u:User {userId: $userId})-[:HAS_TRAIL]->(t:Trail {trailId: $trailId})
           RETURN count(*) AS count`,
          { userId, trailId: trail.trailId },
        ),
      );
      expect(Number(hasTrailCheck.records[0]!.get("count"))).toBe(1);
    });

    /**
     * Тропа может быть "в процессе" — пользователь сейчас проходит курс (toContextId = null).
     * Сценарий: отслеживание текущего обучения до его завершения.
     * Связь STEPS_TO не создаётся, пока курс не завершён.
     */
    it("TC-TR2: creates trail with toContextId = null (ongoing trail)", async () => {
      const { testData } = await loadStoryWithTrails("U19");
      const trail = testData.trails[0]!;

      const trailCheck = await withReadSession(driver, (tx) =>
        tx.run(
          `MATCH (t:Trail {trailId: $trailId})
           RETURN t.toContextId AS toCtx, t.fromContextId AS fromCtx`,
          { trailId: trail.trailId },
        ),
      );
      expect(trailCheck.records[0]!.get("toCtx")).toBeNull();
      expect(trailCheck.records[0]!.get("fromCtx")).toBe(trail.fromContextId);

      // STEPS_ON связь существует
      const stepsOnCheck = await withReadSession(driver, (tx) =>
        tx.run(
          `MATCH (c:Context {contextId: $contextId})-[:STEPS_ON]->(t:Trail {trailId: $trailId})
           RETURN count(*) AS count`,
          { contextId: trail.fromContextId, trailId: trail.trailId },
        ),
      );
      expect(Number(stepsOnCheck.records[0]!.get("count"))).toBe(1);

      // Нет STEPS_TO связи (toContextId = null)
      const stepsToCheck = await withReadSession(driver, (tx) =>
        tx.run(
          `MATCH (t:Trail {trailId: $trailId})-[:STEPS_TO]->(c:Context)
           RETURN count(c) AS count`,
          { trailId: trail.trailId },
        ),
      );
      expect(Number(stepsToCheck.records[0]!.get("count"))).toBe(0);
    });

    /**
     * Тропа создаёт связи Platform и SkillPlatformNode для аналитики.
     * Сценарий: агрегация данных по платформам (сколько людей учились на Udemy).
     * SkillPlatformNode — уникальная комбинация skill+platform для быстрого поиска.
     */
    it("TC-TR3: creates Platform and SkillPlatformNode relationships", async () => {
      const { testData } = await loadStoryWithTrails("U10");
      const trail = testData.trails[0]!;

      const platformCheck = await withReadSession(driver, (tx) =>
        tx.run(
          `MATCH (p:Platform {canonicalName: $platform})
           RETURN p.verified AS verified`,
          { platform: trail.platform },
        ),
      );
      expect(platformCheck.records).toHaveLength(1);
      expect(platformCheck.records[0]!.get("verified")).toBe(false);

      const spnCheck = await withReadSession(driver, (tx) =>
        tx.run(
          `MATCH (t:Trail {trailId: $trailId})-[:DEVELOPS]->(spn:SkillPlatformNode)-[:ON_PLATFORM]->(p:Platform)
           RETURN spn.skill AS skill, spn.platform AS platform, p.canonicalName AS platformName`,
          { trailId: trail.trailId },
        ),
      );
      expect(spnCheck.records).toHaveLength(1);
      expect(spnCheck.records[0]!.get("skill")).toBe(trail.skill);
      expect(spnCheck.records[0]!.get("platform")).toBe(trail.platform);
      expect(spnCheck.records[0]!.get("platformName")).toBe(trail.platform);
    });

    /**
     * Удаление тропы не затрагивает другие тропы пользователя.
     * Сценарий: пользователь удаляет ошибочно добавленный курс.
     * Важно: связи HAS_TRAIL других троп остаются нетронутыми.
     */
    it("TC-TR4: deleteTrail removes only specified trail", async () => {
      const { testData, storyManager } = await loadStoryWithTrails("U10");
      const userId = testData.userId;

      const beforeStory = await storyManager.getUserStory(userId);
      expect(beforeStory.trails).toHaveLength(2);

      const trailToDelete = testData.trails[0]!.trailId;
      const trailToKeep = testData.trails[1]!.trailId;

      const deleteResult = await storyManager.deleteTrail(userId, trailToDelete);
      expect(deleteResult).toBe(true);

      const afterStory = await storyManager.getUserStory(userId);
      expect(afterStory.trails).toHaveLength(1);
      expect(afterStory.trails[0]!.trailId).toBe(trailToKeep);

      const deletedCheck = await withReadSession(driver, (tx) =>
        tx.run("MATCH (t:Trail {trailId: $trailId}) RETURN t", { trailId: trailToDelete }),
      );
      expect(deletedCheck.records).toHaveLength(0);
    });

    /**
     * Удаление контекста не затрагивает другие контексты пользователя.
     * Сценарий: пользователь удаляет последний (текущий) контекст.
     * Каскадное удаление: связи HAS_CONTEXT, HAS_POSITION и т.д. удаляются автоматически.
     * Note: Удаляем последний контекст, т.к. удаление из середины ломает ссылочную целостность.
     */
    it("TC-TR5: deleteContext removes only specified context", async () => {
      const { testData, storyManager } = await loadStoryWithTrails("U11");
      const userId = testData.userId;

      const beforeCount = await withReadSession(driver, (tx) =>
        tx.run("MATCH (u:User {userId: $userId})-[:HAS_CONTEXT]->(c:Context) RETURN count(c) AS cnt", {
          userId,
        }),
      );
      const initialCount = Number(beforeCount.records[0]!.get("cnt"));
      expect(initialCount).toBeGreaterThan(1);

      // Удаляем последний контекст (без nextContextId)
      const lastContext = testData.contexts.at(-1)!;
      const contextToDelete = lastContext.contextId;

      const deleteResult = await storyManager.deleteContext(userId, contextToDelete);
      expect(deleteResult).toBe(true);

      const afterCount = await withReadSession(driver, (tx) =>
        tx.run("MATCH (u:User {userId: $userId})-[:HAS_CONTEXT]->(c:Context) RETURN count(c) AS cnt", {
          userId,
        }),
      );
      expect(Number(afterCount.records[0]!.get("cnt"))).toBe(initialCount - 1);

      const deletedCheck = await withReadSession(driver, (tx) =>
        tx.run("MATCH (c:Context {contextId: $contextId}) RETURN c", {
          contextId: contextToDelete,
        }),
      );
      expect(deletedCheck.records).toHaveLength(0);
    });

    /**
     * Вложенный объект schedule сохраняется корректно (sessionsPerWeek, hoursPerSession).
     * Сценарий: пользователь отслеживает расписание занятий (3 раза в неделю по 2 часа).
     * Cypher денормализует nested object в плоские свойства узла Trail.
     */
    it("TC-TR6: persists trail schedule nested object", async () => {
      const { testData } = await loadStoryWithTrails("U15");
      const trail = testData.trails[0]!;

      const trailCheck = await withReadSession(driver, (tx) =>
        tx.run(
          `MATCH (t:Trail {trailId: $trailId})
           RETURN t.sessionsPerWeek AS sessions, t.hoursPerSession AS hours`,
          { trailId: trail.trailId },
        ),
      );
      expect(trailCheck.records).toHaveLength(1);
      expect(Number(trailCheck.records[0]!.get("sessions"))).toBe(3);
      expect(Number(trailCheck.records[0]!.get("hours"))).toBe(2);
    });

    /**
     * При добавлении нового контекста ongoing trails автоматически завершаются.
     * Сценарий: пользователь учился на курсе (toContextId = null), сменил работу — курс завершён.
     * Cypher обновляет toContextId и создаёт STEPS_TO связь к новому контексту.
     */
    it("TC-TR7: auto-completes ongoing trails when new context is added", async () => {
      const { testData, storyManager } = await loadStoryWithTrails("U19");
      const userId = testData.userId;
      const ongoingTrail = testData.trails[0]!;
      const currentContextId = testData.contexts[1]!.contextId;

      // Trail ongoing до добавления нового контекста
      const beforeCheck = await withReadSession(driver, (tx) =>
        tx.run(`MATCH (t:Trail {trailId: $trailId}) RETURN t.toContextId AS toCtx`, { trailId: ongoingTrail.trailId }),
      );
      expect(beforeCheck.records[0]!.get("toCtx")).toBeNull();

      // Добавляем новый контекст, связанный с предыдущим
      const newContextId = "ctx_019a6ea7-18be-770d-85a1-ea515ab10d21";
      await storyManager.upsertContext({
        userId,
        context: {
          contextId: newContextId,
          previousContextId: currentContextId,
          createdAt: "2025-12-01T00:00:00Z",
          creationReason: ["position_changed"],
          position: "senior",
          industry: "tech",
          companySize: "midsize",
          domains: ["backend", "devops", "platform"],
          skills: ["python", "sql", "docker", "kubernetes"],
          countryCode: "ru",
          cityName: "moscow",
          birthYear: 1998,
          educationLevel: "BACHELOR",
          citizenships: ["ru"],
        },
      });

      // Trail автоматически завершён — toContextId указывает на новый контекст
      const afterCheck = await withReadSession(driver, (tx) =>
        tx.run(`MATCH (t:Trail {trailId: $trailId}) RETURN t.toContextId AS toCtx`, { trailId: ongoingTrail.trailId }),
      );
      expect(afterCheck.records[0]!.get("toCtx")).toBe(newContextId);

      // STEPS_TO связь создана
      const stepsToCheck = await withReadSession(driver, (tx) =>
        tx.run(
          `MATCH (t:Trail {trailId: $trailId})-[:STEPS_TO]->(c:Context {contextId: $contextId})
           RETURN count(*) AS count`,
          { trailId: ongoingTrail.trailId, contextId: newContextId },
        ),
      );
      expect(Number(stepsToCheck.records[0]!.get("count"))).toBe(1);
    });
  });
});
