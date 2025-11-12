import {
  describe,
  test,
  expect,
  beforeEach,
  beforeAll,
  afterAll,
} from "vitest";

import type { Driver } from "neo4j-driver";
import { createDriver, withWriteSession } from "../../../src/neo4j.js";
import { PersistenceManager } from "../../../src/persistence-manager.js";
import { SearchManager } from "../../../src/search-manager.js";
import { SelectivityService } from "../../../src/services/selectivity.service.js";
import { DEFAULT_CONSTRAINTS } from "../../../src/config.js";
import type { StoryInput } from "../../../src/schemas-zod.js";
import { readFileSync } from "fs";
import { join } from "path";
import { ulid } from "ulid";
import { GdsProjectionService } from "../../../src/gds/services/gds-projection.service.js";
import { GdsSimilarityService } from "../../../src/gds/services/gds-similarity.service.js";
import { GdsPathfindingService } from "../../../src/gds/services/gds-pathfinding.service.js";

// Helper to create valid user IDs
const createUserId = () => `usr_${ulid()}`;

describe("Target Reason-Based Search Integration Tests", () => {
  let driver: Driver;
  let persistenceManager: PersistenceManager;
  let searchManager: SearchManager;

  beforeAll(() => {
    driver = createDriver();
    persistenceManager = new PersistenceManager(driver);
    const selectivity = new SelectivityService(driver);

    const gdsProjection = new GdsProjectionService(driver);
    const gdsSimilarity = new GdsSimilarityService(driver, gdsProjection);
    const gdsPathfinding = new GdsPathfindingService(driver, gdsProjection);

    searchManager = new SearchManager(
      driver,
      selectivity,
      gdsSimilarity,
      gdsPathfinding,
      gdsProjection
    );
  });

  beforeEach(async () => {
    // Clean database before each test
    await withWriteSession(driver, async (tx) => {
      await tx.run("MATCH (n) DETACH DELETE n");
    });

    // Re-import reasons
    await withWriteSession(driver, async (tx) => {
      await tx.run(`
        CREATE (r1:Reason {
          reason_id: 'position_changed',
          description: 'Position or role changed within career',
          patterns: ['promoted to', 'changed role to'],
          common_combinations: [],
          examples: ['Promoted from Junior to Senior']
        })
        CREATE (r2:Reason {
          reason_id: 'company_changed',
          description: 'Changed company or employer',
          patterns: ['joined', 'moved to company'],
          common_combinations: [],
          examples: ['Joined Google as SWE']
        })
        CREATE (r3:Reason {
          reason_id: 'skill_learning',
          description: 'Learned new technical skills',
          patterns: ['learned', 'mastered'],
          common_combinations: [],
          examples: ['Learned Kubernetes']
        })
      `);
    });
  });

  afterAll(async () => {
    await driver.close();
  });

  describe("SearchManager - Target Reason-Based Search (BACKWARD)", () => {
    test("searchTargetOnlyMode finds users by reason combinations (backward navigation)", async () => {
      // Load 3 users who reached CTO position
      const user1Path = join(
        process.cwd(),
        "data/trails/users/reason_target_user1.json"
      );
      const user2Path = join(
        process.cwd(),
        "data/trails/users/reason_target_user2.json"
      );
      const user3Path = join(
        process.cwd(),
        "data/trails/users/reason_target_user3.json"
      );

      const user1Story = JSON.parse(readFileSync(user1Path, "utf-8"));
      const user2Story = JSON.parse(readFileSync(user2Path, "utf-8"));
      const user3Story = JSON.parse(readFileSync(user3Path, "utf-8"));

      await persistenceManager.upsertStory(user1Story);
      await persistenceManager.upsertStory(user2Story);
      await persistenceManager.upsertStory(user3Story);

      // Search for CTO position, looking back 12 months
      const results = await searchManager.searchTargetOnlyMode({
        targetPreset: "BALANCED",
        targetContext: {
          position: "CTO",
          industry: "IT",
          company_size: "1000+",
          domains: ["backend"],
        },
        currentUserId: createUserId(),
        searchPeriodMonths: 12,
        searchConstraints: DEFAULT_CONSTRAINTS,
      });

      // Expect 2 combinations:
      // 1. ["position_changed", "company_changed"] - users 1, 2
      // 2. ["position_changed"] - user 3
      expect(results.length).toBe(2);

      const combo1 = results.find(
        (r) =>
          r.combination.length === 2 &&
          r.combination.includes("position_changed") &&
          r.combination.includes("company_changed")
      );
      const combo2 = results.find(
        (r) =>
          r.combination.length === 1 &&
          r.combination.includes("position_changed")
      );

      expect(combo1).toBeDefined();
      expect(combo1!.users_count).toBe(2);
      expect(combo1!.sample_users.length).toBeLessThanOrEqual(2);

      expect(combo2).toBeDefined();
      expect(combo2!.users_count).toBe(1);
      expect(combo2!.sample_users.length).toBe(1);
    });

    test("searchTargetOnlyMode excludes currentUserId", async () => {
      const user1Path = join(
        process.cwd(),
        "data/trails/users/reason_target_user1.json"
      );
      const user1Story = JSON.parse(readFileSync(user1Path, "utf-8"));
      await persistenceManager.upsertStory(user1Story);

      // Exclude user1
      const results = await searchManager.searchTargetOnlyMode({
        targetPreset: "BALANCED",
        targetContext: {
          position: "CTO",
          industry: "IT",
        },
        currentUserId: user1Story.user_id,
        searchPeriodMonths: 12,
        searchConstraints: DEFAULT_CONSTRAINTS,
      });

      // No results since user1 is excluded
      expect(results.length).toBe(0);
    });

    test("searchTargetOnlyMode filters by required_reasons", async () => {
      const user1Path = join(
        process.cwd(),
        "data/trails/users/reason_target_user1.json"
      );
      const user3Path = join(
        process.cwd(),
        "data/trails/users/reason_target_user3.json"
      );

      const user1Story = JSON.parse(readFileSync(user1Path, "utf-8"));
      const user3Story = JSON.parse(readFileSync(user3Path, "utf-8"));

      await persistenceManager.upsertStory(user1Story);
      await persistenceManager.upsertStory(user3Story);

      // Require "company_changed" - only user1 has it
      const results = await searchManager.searchTargetOnlyMode({
        targetPreset: "BALANCED",
        targetContext: {
          position: "CTO",
          industry: "IT",
        },
        currentUserId: createUserId(),
        searchPeriodMonths: 12,
        searchConstraints: DEFAULT_CONSTRAINTS,
        requiredReasons: ["company_changed"],
      });

      expect(results.length).toBe(1);
      expect(results[0]?.combination).toContain("company_changed");
      expect(results[0]?.users_count).toBe(1);
    });

    test("searchTargetOnlyMode filters by excluded_reasons", async () => {
      const user1Path = join(
        process.cwd(),
        "data/trails/users/reason_target_user1.json"
      );
      const user3Path = join(
        process.cwd(),
        "data/trails/users/reason_target_user3.json"
      );

      const user1Story = JSON.parse(readFileSync(user1Path, "utf-8"));
      const user3Story = JSON.parse(readFileSync(user3Path, "utf-8"));

      await persistenceManager.upsertStory(user1Story);
      await persistenceManager.upsertStory(user3Story);

      // Exclude "company_changed" - only user3 remains
      const results = await searchManager.searchTargetOnlyMode({
        targetPreset: "BALANCED",
        targetContext: {
          position: "CTO",
          industry: "IT",
        },
        currentUserId: createUserId(),
        searchPeriodMonths: 12,
        searchConstraints: DEFAULT_CONSTRAINTS,
        excludedReasons: ["company_changed"],
      });

      expect(results.length).toBe(1);
      expect(results[0]?.combination).not.toContain("company_changed");
      expect(results[0]?.users_count).toBe(1);
    });

    test("searchTargetOnlyMode respects lookback boundary ±1 month", async () => {
      // Create user with exact 12 months duration
      const prevCtxId = `ctx_${ulid()}`;
      const ctoCtxId = `ctx_${ulid()}`;

      const userStory = {
        user_id: createUserId(),
        contexts: [
          {
            context_id: prevCtxId,
            created_at: "2023-01-01T00:00:00Z",
            creation_reason: ["started_working"],
            position: "Senior",
            industry: "IT",
            company_size: "1000+",
            domains: ["backend"],
            skills: ["java"],
            country_code: "US",
            city_name: "SF",
            birth_year: 1990,
            citizenships: ["US"],
            previous_context_id: null,
            next_context_id: ctoCtxId,
          },
          {
            context_id: ctoCtxId,
            created_at: "2024-01-01T00:00:00Z", // Exactly 12 months
            creation_reason: ["position_changed"],
            position: "CTO",
            industry: "IT",
            company_size: "1000+",
            domains: ["backend", "management"],
            skills: ["java", "leadership"],
            country_code: "US",
            city_name: "SF",
            birth_year: 1990,
            citizenships: ["US"],
            previous_context_id: prevCtxId,
            next_context_id: null,
          },
        ],
        trails: [],
      } satisfies StoryInput;

      await persistenceManager.upsertStory(userStory);

      // Test 11 months (should match: 12 ± 1)
      const results11 = await searchManager.searchTargetOnlyMode({
        targetPreset: "BALANCED",
        targetContext: {
          position: "CTO",
          industry: "IT",
        },
        currentUserId: createUserId(),
        searchPeriodMonths: 11,
        searchConstraints: DEFAULT_CONSTRAINTS,
      });
      expect(results11.length).toBe(1);

      // Test 13 months (should match: 12 ± 1)
      const results13 = await searchManager.searchTargetOnlyMode({
        targetPreset: "BALANCED",
        targetContext: {
          position: "CTO",
          industry: "IT",
        },
        currentUserId: createUserId(),
        searchPeriodMonths: 13,
        searchConstraints: DEFAULT_CONSTRAINTS,
      });
      expect(results13.length).toBe(1);

      // Test 10 months (should NOT match: outside 12 ± 1)
      const results10 = await searchManager.searchTargetOnlyMode({
        targetPreset: "BALANCED",
        targetContext: {
          position: "CTO",
          industry: "IT",
        },
        currentUserId: createUserId(),
        searchPeriodMonths: 10,
        searchConstraints: DEFAULT_CONSTRAINTS,
      });
      expect(results10.length).toBe(0);
    });

    test("searchTargetOnlyMode calculates median correctly for odd count", async () => {
      // Create 3 users with durations: 11, 12, 13 months
      // Median should be 12.0

      const createUser = (
        userId: string,
        durationMonths: number
      ): StoryInput => {
        const startDate = new Date("2023-01-01");
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + durationMonths);

        const prevCtxId = `ctx_${ulid()}`;
        const ctoCtxId = `ctx_${ulid()}`;

        return {
          user_id: userId,
          contexts: [
            {
              context_id: prevCtxId,
              created_at: startDate.toISOString(),
              creation_reason: ["started_working"],
              position: "Senior",
              industry: "IT",
              company_size: "1000+",
              domains: ["backend"],
              skills: ["java"],
              country_code: "US",
              city_name: "SF",
              birth_year: 1990,
              citizenships: ["US"],
              previous_context_id: null,
              next_context_id: ctoCtxId,
            },
            {
              context_id: ctoCtxId,
              created_at: endDate.toISOString(),
              creation_reason: ["position_changed"],
              position: "CTO",
              industry: "IT",
              company_size: "1000+",
              domains: ["backend", "management"],
              skills: ["java", "leadership"],
              country_code: "US",
              city_name: "SF",
              birth_year: 1990,
              citizenships: ["US"],
              previous_context_id: prevCtxId,
              next_context_id: null,
            },
          ],
          trails: [],
        };
      };

      await persistenceManager.upsertStory(createUser(createUserId(), 11));
      await persistenceManager.upsertStory(createUser(createUserId(), 12));
      await persistenceManager.upsertStory(createUser(createUserId(), 13));

      const results = await searchManager.searchTargetOnlyMode({
        targetPreset: "BALANCED",
        targetContext: {
          position: "CTO",
          industry: "IT",
        },
        currentUserId: createUserId(),
        searchPeriodMonths: 12,
        searchConstraints: DEFAULT_CONSTRAINTS,
      });

      expect(results.length).toBe(1);
      expect(results[0]?.stats.median_duration_months).toBe(12.0);
      expect(results[0]?.users_count).toBe(3);
    });

    test("searchTargetOnlyMode sample_users have correct graph structure (backward)", async () => {
      const user1Path = join(
        process.cwd(),
        "data/trails/users/reason_target_user1.json"
      );
      const user1Story = JSON.parse(readFileSync(user1Path, "utf-8"));
      await persistenceManager.upsertStory(user1Story);

      const results = await searchManager.searchTargetOnlyMode({
        targetPreset: "BALANCED",
        targetContext: {
          position: "CTO",
          industry: "IT",
        },
        currentUserId: createUserId(),
        searchPeriodMonths: 12,
        searchConstraints: DEFAULT_CONSTRAINTS,
      });

      expect(results.length).toBeGreaterThan(0);
      const sampleUser = results[0]?.sample_users[0];

      // Verify graph structure
      expect(sampleUser?.user_graph.user.user_id).toBeDefined();

      // For backward search: matched_context is CTO, related_context is previous position
      expect(sampleUser?.user_graph.matched_context.position).toBe("CTO");
      expect(sampleUser?.user_graph.related_context.position).toBe("Senior");
    });

    test("searchTargetOnlyMode aggregates previous_positions correctly", async () => {
      const user1Path = join(
        process.cwd(),
        "data/trails/users/reason_target_user1.json"
      );
      const user2Path = join(
        process.cwd(),
        "data/trails/users/reason_target_user2.json"
      );

      const user1Story = JSON.parse(readFileSync(user1Path, "utf-8"));
      const user2Story = JSON.parse(readFileSync(user2Path, "utf-8"));

      await persistenceManager.upsertStory(user1Story);
      await persistenceManager.upsertStory(user2Story);

      const results = await searchManager.searchTargetOnlyMode({
        targetPreset: "BALANCED",
        targetContext: {
          position: "CTO",
          industry: "IT",
        },
        currentUserId: createUserId(),
        searchPeriodMonths: 12,
        searchConstraints: DEFAULT_CONSTRAINTS,
      });

      // Find combo with both users
      const combo = results.find((r) => r.users_count === 2);
      expect(combo).toBeDefined();

      // Check target_positions distribution
      expect(combo!.stats.target_positions).toBeDefined();
      expect(combo!.stats.target_positions.length).toBeGreaterThan(0);

      // Should have positions from related contexts: Senior and TechLead
      const positions = combo!.stats.target_positions.map((p) => p.position);
      expect(positions).toContain("Senior");
      expect(positions).toContain("TechLead");
    });

    test("searchTargetOnlyMode handles empty results gracefully", async () => {
      // Search for non-existent target
      const results = await searchManager.searchTargetOnlyMode({
        targetPreset: "BALANCED",
        targetContext: {
          position: "CEO", // No CEOs in fixtures
          industry: "IT",
        },
        currentUserId: createUserId(),
        searchPeriodMonths: 12,
        searchConstraints: DEFAULT_CONSTRAINTS,
      });

      expect(results.length).toBe(0);
    });
  });
});
