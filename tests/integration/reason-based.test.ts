import {
  describe,
  test,
  expect,
  beforeEach,
  beforeAll,
  afterAll,
} from "vitest";

import type { Driver } from "neo4j-driver";
import { createDriver, withWriteSession } from "../../src/neo4j.js";
import { PersistenceManager } from "../../src/persistence-manager.js";
import { SearchManager } from "../../src/search-manager.js";
import { SearchQueryBuilder } from "../../src/orcestrator/search-query-builder.js";
import { SelectivityService } from "../../src/services/selectivity.service.js";
import { readFileSync } from "fs";
import { join } from "path";

describe("Reason-Based Search Integration Tests", () => {
  let driver: Driver;
  let persistenceManager: PersistenceManager;
  // let searchManager: SearchManager;  // TODO: Will be used when implementing search tests

  beforeAll(() => {
    driver = createDriver();
    persistenceManager = new PersistenceManager(driver);

    // TODO: Uncomment when implementing search tests
    // const builder = new SearchQueryBuilder();
    // const selectivity = new SelectivityService(driver);
    // searchManager = new SearchManager(driver, builder, selectivity);
  });

  beforeEach(async () => {
    // Clean database before each test
    await withWriteSession(driver, async (tx) => {
      await tx.run("MATCH (n) DETACH DELETE n");
    });

    // Re-import reasons after cleanup
    // Note: In real tests, reasons should be imported via setup script
    await withWriteSession(driver, async (tx) => {
      await tx.run(`
        CREATE (r1:Reason {
          reason_id: 'position_changed',
          description: 'Position or role changed within career',
          patterns: ['promoted to', 'changed role to'],
          common_combinations: [],
          examples: ['Promoted from Junior to Mid Developer']
        })
        CREATE (r2:Reason {
          reason_id: 'location_changed',
          description: 'Relocated to different city or country',
          patterns: ['moved to', 'relocated to'],
          common_combinations: [],
          examples: ['Moved from Moscow to Berlin']
        })
        CREATE (r3:Reason {
          reason_id: 'skill_learning',
          description: 'Learned new technical skills or framework',
          patterns: ['learned', 'mastered'],
          common_combinations: [],
          examples: ['Learned React and TypeScript']
        })
      `);
    });
  });

  afterAll(async () => {
    await driver.close();
  });

  describe("PersistenceManager - Reason Management", () => {
    test("listAvailableReasons returns all reasons from database", async () => {
      const reasons = await persistenceManager.listAvailableReasons();

      expect(reasons).toHaveLength(3);
      expect(reasons[0]).toMatchObject({
        reason_id: expect.stringMatching(/^(position_changed|location_changed|skill_learning)$/),
        description: expect.any(String),
        patterns: expect.any(Array),
        examples: expect.any(Array),
      });
    });

    test("createNewReason creates a new reason node", async () => {
      const newReason = await persistenceManager.createNewReason(
        "company_changed",
        "Changed employer or company",
        ["switched to", "joined"],
        ["Joined Google from startup"],
        "ctx_test123"
      );

      expect(newReason).toMatchObject({
        reason_id: "company_changed",
        description: "Changed employer or company",
        patterns: ["switched to", "joined"],
        examples: ["Joined Google from startup"],
      });

      // Verify it's in database
      const allReasons = await persistenceManager.listAvailableReasons();
      expect(allReasons).toHaveLength(4);
    });
  });

  describe("SearchManager - Reason-Based Search", () => {
    let searchManager: SearchManager;

    beforeAll(() => {
      const builder = new SearchQueryBuilder();
      const selectivity = new SelectivityService(driver);
      searchManager = new SearchManager(driver, builder, selectivity);
    });

    test("searchCurrentReasonBased finds users by reason combinations", async () => {
      // Load test users from JSON files
      const user1 = JSON.parse(
        readFileSync(
          join(process.cwd(), "data/trails/users/reason_test_user1.json"),
          "utf-8"
        )
      );
      const user2 = JSON.parse(
        readFileSync(
          join(process.cwd(), "data/trails/users/reason_test_user2.json"),
          "utf-8"
        )
      );
      const user3 = JSON.parse(
        readFileSync(
          join(process.cwd(), "data/trails/users/reason_test_user3.json"),
          "utf-8"
        )
      );

      // Upsert users via PersistenceManager
      await persistenceManager.upsertStory(user1);
      await persistenceManager.upsertStory(user2);
      await persistenceManager.upsertStory(user3);

      // Create :NEXT relationships with duration_months
      await withWriteSession(driver, async (tx) => {
        await tx.run(
          `
          // User 1: 12 months duration
          MATCH (c1:Context {context_id: $ctx1_current})
          MATCH (f1:Context {context_id: $ctx1_future})
          MERGE (c1)-[:NEXT {duration_months: $duration1}]->(f1)
          WITH c1, f1

          // User 2: 11 months duration
          MATCH (c2:Context {context_id: $ctx2_current})
          MATCH (f2:Context {context_id: $ctx2_future})
          MERGE (c2)-[:NEXT {duration_months: $duration2}]->(f2)
          WITH c2, f2

          // User 3: 12 months duration
          MATCH (c3:Context {context_id: $ctx3_current})
          MATCH (f3:Context {context_id: $ctx3_future})
          MERGE (c3)-[:NEXT {duration_months: $duration3}]->(f3)
        `,
          {
            ctx1_current: "ctx_01JAA000000000000000000001",
            ctx1_future: "ctx_01JAA000000000000000000002",
            duration1: 12,
            ctx2_current: "ctx_01JAA000000000000000000003",
            ctx2_future: "ctx_01JAA000000000000000000004",
            duration2: 11,
            ctx3_current: "ctx_01JAA000000000000000000005",
            ctx3_future: "ctx_01JAA000000000000000000006",
            duration3: 12,
          }
        );
      });

      // Search for reason combinations from Junior context
      // Using user1's ID to test currentUserId exclusion
      const results = await searchManager.searchCurrentReasonBased({
        currentPreset: "full",
        currentContext: {
          position: "Junior",
          domains: ["backend"],
          skills: ["javascript"],
          industry: "IT",
          country_code: "RU",
        },
        currentUserId: "usr_01JAB000000000000000000001", // user1 - should be excluded
        lookahead_months: 12,
      });

      // Verify we got 2 different reason combinations
      expect(results).toHaveLength(2);

      // Find the combination with ['position_changed', 'skill_learning']
      const positionSkillCombo = results.find(
        (r) =>
          r.combination.includes("position_changed") &&
          r.combination.includes("skill_learning")
      );
      expect(positionSkillCombo).toBeDefined();
      if (!positionSkillCombo) throw new Error("positionSkillCombo not found");

      // CRITICAL: user1 should be EXCLUDED (currentUserId), only user2 remains
      expect(positionSkillCombo.users_count).toBe(1); // only user_2
      expect(positionSkillCombo.stats.avg_duration_months).toBe(11); // only user2's 11 months
      expect(positionSkillCombo.stats.median_duration_months).toBe(11); // only user2's 11 months
      expect(positionSkillCombo.sample_users).toHaveLength(1);
      const sampleUser = positionSkillCombo.sample_users[0];
      if (!sampleUser) throw new Error("Sample user not found");
      expect(sampleUser.user_id).toBe("usr_01JAB000000000000000000002");

      // Verify target_positions stats
      expect(positionSkillCombo.stats.target_positions).toHaveLength(1);
      expect(positionSkillCombo.stats.target_positions[0]).toMatchObject({
        position: "Middle",
        count: 1, // only user2
      });

      // Verify common_skills_gained (both users gained typescript and react)
      expect(positionSkillCombo.stats.common_skills_gained).toContain("typescript");
      expect(positionSkillCombo.stats.common_skills_gained).toContain("react");

      // Find the combination with ['location_changed']
      const locationCombo = results.find(
        (r) =>
          r.combination.length === 1 &&
          r.combination[0] === "location_changed"
      );
      expect(locationCombo).toBeDefined();
      if (!locationCombo) throw new Error("locationCombo not found");
      expect(locationCombo.users_count).toBe(1); // user_3
    });

    test("searchCurrentReasonBased handles empty results gracefully", async () => {
      // Load user that won't match the filters
      const userNoMatch = JSON.parse(
        readFileSync(
          join(process.cwd(), "data/trails/users/reason_test_nomatch.json"),
          "utf-8"
        )
      );

      await persistenceManager.upsertStory(userNoMatch);

      // Create :NEXT relationship with 24 months duration
      await withWriteSession(driver, async (tx) => {
        await tx.run(
          `
          MATCH (c:Context {context_id: $ctx_current})
          MATCH (f:Context {context_id: $ctx_future})
          MERGE (c)-[:NEXT {duration_months: $duration}]->(f)
        `,
          {
            ctx_current: "ctx_01JAA000000000000000000007",
            ctx_future: "ctx_01JAA000000000000000000008",
            duration: 24,
          }
        );
      });

      // Search with completely different context
      const results = await searchManager.searchCurrentReasonBased({
        currentPreset: "full",
        currentContext: {
          position: "Junior",
          domains: ["ux", "ui"],
          skills: ["figma", "sketch"],
          industry: "EdTech",
          country_code: "RU",
        },
        currentUserId: "usr_01HX91F0C0R000000000000000",
        lookahead_months: 12,
      });

      // Should return empty array when no matches
      expect(results).toEqual([]);
    });

    test("searchCurrentReasonBased validates lookahead_months range", async () => {
      const validContext = {
        position: "Junior" as const,
        domains: ["backend"],
        skills: ["javascript"],
        industry: "IT",
        country_code: "RU",
      };

      // Test invalid lookahead_months (below min)
      await expect(
        searchManager.searchCurrentReasonBased({
          currentPreset: "full",
          currentContext: validContext,
          currentUserId: "usr_01HX91F0C0R000000000000000",
          lookahead_months: 0, // Invalid: below min(1)
        })
      ).rejects.toThrow();

      // Test invalid lookahead_months (above max)
      await expect(
        searchManager.searchCurrentReasonBased({
          currentPreset: "full",
          currentContext: validContext,
          currentUserId: "usr_01HX91F0C0R000000000000000",
          lookahead_months: 61, // Invalid: above max(60)
        })
      ).rejects.toThrow();

      // Valid range should work (no error)
      // Note: May return empty results, but shouldn't throw validation error
      await expect(
        searchManager.searchCurrentReasonBased({
          currentPreset: "full",
          currentContext: validContext,
          currentUserId: "usr_01HX91F0C0R000000000000000",
          lookahead_months: 12, // Valid: within range
        })
      ).resolves.toBeDefined();
    });

    test("searchCurrentReasonBased filters by required_reasons", async () => {
      // Setup: Load all 3 test users (user1, user2, user3)
      const user1 = JSON.parse(
        readFileSync(
          join(process.cwd(), "data/trails/users/reason_test_user1.json"),
          "utf-8"
        )
      );
      const user2 = JSON.parse(
        readFileSync(
          join(process.cwd(), "data/trails/users/reason_test_user2.json"),
          "utf-8"
        )
      );
      const user3 = JSON.parse(
        readFileSync(
          join(process.cwd(), "data/trails/users/reason_test_user3.json"),
          "utf-8"
        )
      );

      await persistenceManager.upsertStory(user1);
      await persistenceManager.upsertStory(user2);
      await persistenceManager.upsertStory(user3);

      // Create :NEXT relationships
      await withWriteSession(driver, async (tx) => {
        await tx.run(
          `
          MATCH (c1:Context {context_id: $ctx1_current})
          MATCH (f1:Context {context_id: $ctx1_future})
          MERGE (c1)-[:NEXT {duration_months: $duration1}]->(f1)
          WITH c1, f1

          MATCH (c2:Context {context_id: $ctx2_current})
          MATCH (f2:Context {context_id: $ctx2_future})
          MERGE (c2)-[:NEXT {duration_months: $duration2}]->(f2)
          WITH c2, f2

          MATCH (c3:Context {context_id: $ctx3_current})
          MATCH (f3:Context {context_id: $ctx3_future})
          MERGE (c3)-[:NEXT {duration_months: $duration3}]->(f3)
        `,
          {
            ctx1_current: "ctx_01JAA000000000000000000001",
            ctx1_future: "ctx_01JAA000000000000000000002",
            duration1: 12,
            ctx2_current: "ctx_01JAA000000000000000000003",
            ctx2_future: "ctx_01JAA000000000000000000004",
            duration2: 11,
            ctx3_current: "ctx_01JAA000000000000000000005",
            ctx3_future: "ctx_01JAA000000000000000000006",
            duration3: 12,
          }
        );
      });

      // Search with required_reasons filter
      const results = await searchManager.searchCurrentReasonBased({
        currentPreset: "full",
        currentContext: {
          position: "Junior",
          domains: ["backend"],
          skills: ["javascript"],
          industry: "IT",
          country_code: "RU",
        },
        currentUserId: "usr_01ZZZ000000000000000000000", // Non-existent user (valid ULID format) to not exclude anyone
        lookahead_months: 12,
        required_reasons: ["position_changed", "skill_learning"],
      });

      // CRITICAL: Should return ONLY the combo with ['position_changed', 'skill_learning']
      // User3's ['location_changed'] combo should be FILTERED OUT
      expect(results).toHaveLength(1);
      if (!results[0]) throw new Error("Result not found");
      expect(results[0].combination).toEqual(
        expect.arrayContaining(["position_changed", "skill_learning"])
      );
      expect(results[0].users_count).toBe(2); // user1 and user2
    });

    test("searchCurrentReasonBased filters by excluded_reasons", async () => {
      // Setup: Load all 3 test users
      const user1 = JSON.parse(
        readFileSync(
          join(process.cwd(), "data/trails/users/reason_test_user1.json"),
          "utf-8"
        )
      );
      const user2 = JSON.parse(
        readFileSync(
          join(process.cwd(), "data/trails/users/reason_test_user2.json"),
          "utf-8"
        )
      );
      const user3 = JSON.parse(
        readFileSync(
          join(process.cwd(), "data/trails/users/reason_test_user3.json"),
          "utf-8"
        )
      );

      await persistenceManager.upsertStory(user1);
      await persistenceManager.upsertStory(user2);
      await persistenceManager.upsertStory(user3);

      // Create :NEXT relationships
      await withWriteSession(driver, async (tx) => {
        await tx.run(
          `
          MATCH (c1:Context {context_id: $ctx1_current})
          MATCH (f1:Context {context_id: $ctx1_future})
          MERGE (c1)-[:NEXT {duration_months: $duration1}]->(f1)
          WITH c1, f1

          MATCH (c2:Context {context_id: $ctx2_current})
          MATCH (f2:Context {context_id: $ctx2_future})
          MERGE (c2)-[:NEXT {duration_months: $duration2}]->(f2)
          WITH c2, f2

          MATCH (c3:Context {context_id: $ctx3_current})
          MATCH (f3:Context {context_id: $ctx3_future})
          MERGE (c3)-[:NEXT {duration_months: $duration3}]->(f3)
        `,
          {
            ctx1_current: "ctx_01JAA000000000000000000001",
            ctx1_future: "ctx_01JAA000000000000000000002",
            duration1: 12,
            ctx2_current: "ctx_01JAA000000000000000000003",
            ctx2_future: "ctx_01JAA000000000000000000004",
            duration2: 11,
            ctx3_current: "ctx_01JAA000000000000000000005",
            ctx3_future: "ctx_01JAA000000000000000000006",
            duration3: 12,
          }
        );
      });

      // Search with excluded_reasons filter
      const results = await searchManager.searchCurrentReasonBased({
        currentPreset: "full",
        currentContext: {
          position: "Junior",
          domains: ["backend"],
          skills: ["javascript"],
          industry: "IT",
          country_code: "RU",
        },
        currentUserId: "usr_01ZZZ000000000000000000000", // Non-existent user (valid ULID format)
        lookahead_months: 12,
        excluded_reasons: ["location_changed"],
      });

      // CRITICAL: Should return ONLY the combo WITHOUT 'location_changed'
      // User3's ['location_changed'] combo should be EXCLUDED
      expect(results).toHaveLength(1);
      if (!results[0]) throw new Error("Result not found");
      expect(results[0].combination).toEqual(
        expect.arrayContaining(["position_changed", "skill_learning"])
      );
      expect(results[0].combination).not.toContain("location_changed");
      expect(results[0].users_count).toBe(2); // user1 and user2
    });

    test("searchCurrentReasonBased respects lookahead boundary ±1 month", async () => {
      // Create 4 users with different durations: 10, 11, 13, 14 months
      // For lookahead_months=12, should include only 11 and 13 (within ±1 range)

      const createUser = async (
        userId: string,
        ctxCurrent: string,
        ctxFuture: string,
        duration: number
      ) => {
        const userStory = {
          user_id: userId,
          contexts: [
            {
              context_id: ctxCurrent,
              created_at: "2023-01-01T00:00:00Z",
              creation_reason: ["started_working"],
              position: "Junior",
              industry: "IT",
              company_size: "100-500",
              domains: ["backend"],
              skills: ["javascript"],
              work_type: "office",
              team_size: 5,
              country_code: "RU",
              city_name: "Moscow",
              birth_year: 1995,
              citizenships: ["RU"],
              previous_context_id: null,
              next_context_id: ctxFuture,
            },
            {
              context_id: ctxFuture,
              created_at: "2024-01-01T00:00:00Z",
              creation_reason: ["position_changed"],
              position: "Middle",
              industry: "IT",
              company_size: "100-500",
              domains: ["backend"],
              skills: ["javascript", "typescript"],
              work_type: "office",
              team_size: 5,
              country_code: "RU",
              city_name: "Moscow",
              birth_year: 1995,
              citizenships: ["RU"],
              previous_context_id: ctxCurrent,
              next_context_id: null,
            },
          ],
          trails: [],
        };

        await persistenceManager.upsertStory(userStory as any);

        await withWriteSession(driver, async (tx) => {
          await tx.run(
            `
            MATCH (c:Context {context_id: $ctxCurrent})
            MATCH (f:Context {context_id: $ctxFuture})
            MERGE (c)-[:NEXT {duration_months: $duration}]->(f)
          `,
            { ctxCurrent, ctxFuture, duration }
          );
        });
      };

      // Create users with different durations
      await createUser(
        "usr_01JAC000000000000000000001",
        "ctx_01JAC000000000000000000001",
        "ctx_01JAC000000000000000000002",
        10 // Out of range (12-1=11)
      );
      await createUser(
        "usr_01JAC000000000000000000002",
        "ctx_01JAC000000000000000000003",
        "ctx_01JAC000000000000000000004",
        11 // In range
      );
      await createUser(
        "usr_01JAC000000000000000000003",
        "ctx_01JAC000000000000000000005",
        "ctx_01JAC000000000000000000006",
        13 // In range
      );
      await createUser(
        "usr_01JAC000000000000000000004",
        "ctx_01JAC000000000000000000007",
        "ctx_01JAC000000000000000000008",
        14 // Out of range (12+1=13)
      );

      // Search with lookahead_months=12 (should match 11-13 range)
      const results = await searchManager.searchCurrentReasonBased({
        currentPreset: "full",
        currentContext: {
          position: "Junior",
          domains: ["backend"],
          skills: ["javascript"],
          industry: "IT",
          country_code: "RU",
        },
        currentUserId: "usr_01ZZZ000000000000000000000", // Non-existent user (valid ULID format)
        lookahead_months: 12,
      });

      // Should find 1 combo with ['position_changed']
      expect(results).toHaveLength(1);
      if (!results[0]) throw new Error("Result not found");
      expect(results[0].combination).toEqual(["position_changed"]);

      // CRITICAL: Should include ONLY users with duration 11 and 13
      expect(results[0].users_count).toBe(2); // user2 (11mo) and user3 (13mo)
      expect(results[0].stats.avg_duration_months).toBe(12); // (11+13)/2
      expect(results[0].stats.median_duration_months).toBe(12); // (11+13)/2 for even count
    });

    test("searchCurrentReasonBased calculates median correctly for odd count", async () => {
      // Create 3 users with durations: 10, 11, 12 months
      // Median should be 11.0 (middle element)

      const createUser = async (
        userId: string,
        ctxCurrent: string,
        ctxFuture: string,
        duration: number
      ) => {
        const userStory = {
          user_id: userId,
          contexts: [
            {
              context_id: ctxCurrent,
              created_at: "2023-01-01T00:00:00Z",
              creation_reason: ["started_working"],
              position: "Junior",
              industry: "IT",
              company_size: "100-500",
              domains: ["backend"],
              skills: ["javascript"],
              work_type: "office",
              team_size: 5,
              country_code: "RU",
              city_name: "Moscow",
              birth_year: 1995,
              citizenships: ["RU"],
              previous_context_id: null,
              next_context_id: ctxFuture,
            },
            {
              context_id: ctxFuture,
              created_at: "2024-01-01T00:00:00Z",
              creation_reason: ["position_changed"],
              position: "Middle",
              industry: "IT",
              company_size: "100-500",
              domains: ["backend"],
              skills: ["javascript", "typescript"],
              work_type: "office",
              team_size: 5,
              country_code: "RU",
              city_name: "Moscow",
              birth_year: 1995,
              citizenships: ["RU"],
              previous_context_id: ctxCurrent,
              next_context_id: null,
            },
          ],
          trails: [],
        };

        await persistenceManager.upsertStory(userStory as any);

        await withWriteSession(driver, async (tx) => {
          await tx.run(
            `
            MATCH (c:Context {context_id: $ctxCurrent})
            MATCH (f:Context {context_id: $ctxFuture})
            MERGE (c)-[:NEXT {duration_months: $duration}]->(f)
          `,
            { ctxCurrent, ctxFuture, duration }
          );
        });
      };

      // Create 3 users with durations 10, 11, 12
      await createUser(
        "usr_01JAD000000000000000000001",
        "ctx_01JAD000000000000000000001",
        "ctx_01JAD000000000000000000002",
        10
      );
      await createUser(
        "usr_01JAD000000000000000000002",
        "ctx_01JAD000000000000000000003",
        "ctx_01JAD000000000000000000004",
        11
      );
      await createUser(
        "usr_01JAD000000000000000000003",
        "ctx_01JAD000000000000000000005",
        "ctx_01JAD000000000000000000006",
        12
      );

      // Search with wide lookahead to include all 3 users
      const results = await searchManager.searchCurrentReasonBased({
        currentPreset: "full",
        currentContext: {
          position: "Junior",
          domains: ["backend"],
          skills: ["javascript"],
          industry: "IT",
          country_code: "RU",
        },
        currentUserId: "usr_01ZZZ000000000000000000000", // Non-existent user (valid ULID format)
        lookahead_months: 11, // Will match 10-12 range
      });

      expect(results).toHaveLength(1);
      if (!results[0]) throw new Error("Result not found");
      expect(results[0].users_count).toBe(3);

      // CRITICAL: For odd count [10, 11, 12], median should be 11.0 (middle element)
      expect(results[0].stats.median_duration_months).toBe(11);
      expect(results[0].stats.avg_duration_months).toBeCloseTo(11, 1); // (10+11+12)/3 ≈ 11
    });

    test("searchCurrentReasonBased excludes users with null creation_reason", async () => {
      // Load edge case fixture with null creation_reason
      const userNullReason = JSON.parse(
        readFileSync(
          join(process.cwd(), "data/trails/users/user_edge_null_reason.json"),
          "utf-8"
        )
      );

      await persistenceManager.upsertStory(userNullReason);

      // Extract IDs from fixture (NO hardcoding!)
      const ctxCurrent = userNullReason.contexts[0].context_id;
      const ctxFuture = userNullReason.contexts[1].context_id;

      // Create :NEXT relationship
      await withWriteSession(driver, async (tx) => {
        await tx.run(
          `
          MATCH (c:Context {context_id: $ctxCurrent})
          MATCH (f:Context {context_id: $ctxFuture})
          MERGE (c)-[:NEXT {duration_months: $duration}]->(f)
        `,
          {
            ctxCurrent,
            ctxFuture,
            duration: 12,
          }
        );
      });

      // Search - should NOT find user with null creation_reason
      const results = await searchManager.searchCurrentReasonBased({
        currentPreset: "full",
        currentContext: {
          position: "Junior",
          domains: ["backend"],
          skills: ["javascript"],
          industry: "IT",
          country_code: "RU",
        },
        currentUserId: "usr_01ZZZ000000000000000000000",
        lookahead_months: 12,
      });

      // CRITICAL: User with null creation_reason must be EXCLUDED
      expect(results).toEqual([]);
    });

    test("searchCurrentReasonBased excludes users with empty creation_reason array", async () => {
      // Load edge case fixture with empty creation_reason
      const userEmptyReason = JSON.parse(
        readFileSync(
          join(process.cwd(), "data/trails/users/user_edge_empty_reason.json"),
          "utf-8"
        )
      );

      await persistenceManager.upsertStory(userEmptyReason);

      // Extract IDs from fixture (NO hardcoding!)
      const ctxCurrent = userEmptyReason.contexts[0].context_id;
      const ctxFuture = userEmptyReason.contexts[1].context_id;

      // Create :NEXT relationship
      await withWriteSession(driver, async (tx) => {
        await tx.run(
          `
          MATCH (c:Context {context_id: $ctxCurrent})
          MATCH (f:Context {context_id: $ctxFuture})
          MERGE (c)-[:NEXT {duration_months: $duration}]->(f)
        `,
          {
            ctxCurrent,
            ctxFuture,
            duration: 12,
          }
        );
      });

      // Search - should NOT find user with empty creation_reason
      const results = await searchManager.searchCurrentReasonBased({
        currentPreset: "full",
        currentContext: {
          position: "Junior",
          domains: ["backend"],
          skills: ["javascript"],
          industry: "IT",
          country_code: "RU",
        },
        currentUserId: "usr_01ZZZ000000000000000000000",
        lookahead_months: 12,
      });

      // CRITICAL: User with empty creation_reason must be EXCLUDED
      expect(results).toEqual([]);
    });

    test("searchCurrentReasonBased handles required_reasons + excluded_reasons conflict", async () => {
      // Setup: Load test users
      const user1 = JSON.parse(
        readFileSync(
          join(process.cwd(), "data/trails/users/reason_test_user1.json"),
          "utf-8"
        )
      );

      await persistenceManager.upsertStory(user1);

      // Extract IDs from fixture
      const ctxCurrent = user1.contexts[0].context_id;
      const ctxFuture = user1.contexts[1].context_id;

      // Create :NEXT relationship
      await withWriteSession(driver, async (tx) => {
        await tx.run(
          `
          MATCH (c:Context {context_id: $ctxCurrent})
          MATCH (f:Context {context_id: $ctxFuture})
          MERGE (c)-[:NEXT {duration_months: $duration}]->(f)
        `,
          {
            ctxCurrent,
            ctxFuture,
            duration: 12,
          }
        );
      });

      // Search with conflicting filters: require AND exclude 'position_changed'
      const results = await searchManager.searchCurrentReasonBased({
        currentPreset: "full",
        currentContext: {
          position: "Junior",
          domains: ["backend"],
          skills: ["javascript"],
          industry: "IT",
          country_code: "RU",
        },
        currentUserId: "usr_01ZZZ000000000000000000000",
        lookahead_months: 12,
        required_reasons: ["position_changed"],
        excluded_reasons: ["position_changed"], // CONFLICT!
      });

      // CRITICAL: Conflicting filters should return empty results
      expect(results).toEqual([]);
    });

    test("searchCurrentReasonBased throws error for invalid preset", async () => {
      // Test with non-existent preset
      await expect(
        searchManager.searchCurrentReasonBased({
          currentPreset: "NON_EXISTENT_PRESET" as any, // Invalid preset - bypass TypeScript check
          currentContext: {
            position: "Junior",
            domains: ["backend"],
            skills: ["javascript"],
            industry: "IT",
            country_code: "RU",
          },
          currentUserId: "usr_01ZZZ000000000000000000000",
          lookahead_months: 12,
        })
      ).rejects.toThrow(); // Should throw validation error
    });
  });
});
