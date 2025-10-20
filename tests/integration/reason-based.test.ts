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
    test.todo("searchCurrentReasonBased finds users by reason combinations");
    // TODO: Need to create test data with:
    // - Users with contexts having creation_reason arrays
    // - Temporal navigation via :NEXT relationships
    // - Test filtering by required_reasons and excluded_reasons

    test.todo("searchCurrentReasonBased handles empty results gracefully");
    // TODO: Test case where no users match the criteria

    test.todo("searchCurrentReasonBased validates lookahead_months range");
    // TODO: Test validation of lookahead_months (1-60)
  });
});
