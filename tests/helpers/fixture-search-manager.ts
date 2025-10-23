import { Driver } from "neo4j-driver";

import { SearchQueryBuilder } from "../../src/orcestrator/search-query-builder.js";
import { SearchManager } from "../../src/search-manager.js";

import {
  UserContextSchema,
  TargetContextSchema,
  SearchConstraints,
  PipelineGraphResult,
} from "../../src/schemas-zod.js";

import { TestDataManager, type UserKey } from "./test-data-manager.js";
import { DEFAULT_CONSTRAINTS } from "../../src/config.js";
import { PersistenceManager } from "../../src/persistence-manager.js";
import { SelectivityService } from "../../src/services/selectivity.service.js";
import { GdsProjectionService } from "../../src/gds/services/gds-projection.service.js";
import { GdsSimilarityService } from "../../src/gds/services/gds-similarity.service.js";
import { GdsPathfindingService } from "../../src/gds/services/gds-pathfinding.service.js";
import { ReasonAnalyticsService } from "../../src/services/reason-analytics.service.js";

export class FixtureSearchManager {
  private searchManager: SearchManager;
  private persistenceManager: PersistenceManager;
  private testDataManager: TestDataManager;

  constructor(driver: Driver) {
    const builder = new SearchQueryBuilder();
    const selectivity = new SelectivityService(driver);

    // Initialize GDS services (for existing reason-based tests, these won't be used)
    const gdsProjection = new GdsProjectionService(driver);
    const gdsSimilarity = new GdsSimilarityService(driver, gdsProjection);
    const gdsPathfinding = new GdsPathfindingService(driver, gdsProjection);

    // Initialize ReasonAnalyticsService (Week 2 Day 4 Part 2)
    const reasonAnalytics = new ReasonAnalyticsService(driver);

    this.searchManager = new SearchManager(
      driver,
      builder,
      selectivity,
      gdsSimilarity,
      gdsPathfinding,
      gdsProjection
    );
    this.persistenceManager = new PersistenceManager(driver);
    this.testDataManager = new TestDataManager();
  }

  async runPipeline(
    userKey: UserKey,
    otherUserKeys: UserKey[],
    currentPreset: string,
    targetPreset: string,
    searchConstraints: SearchConstraints
  ): Promise<PipelineGraphResult[]> {
    const userData = this.testDataManager.getStoryBy(userKey);
    await this.persistenceManager.upsertStory(userData);

    for (const otherUserKey of otherUserKeys) {
      const otherUserData = this.testDataManager.getStoryBy(otherUserKey);
      await this.persistenceManager.upsertStory(otherUserData);
    }

    const currentContext = UserContextSchema.parse(userData.contexts[0]);
    const targetContext = TargetContextSchema.parse(
      userData.contexts[userData.contexts.length - 1]
    );

    return this.searchManager.searchPipeline({
      currentPreset,
      currentContext,
      targetPreset,
      targetContext,
      currentUserId: userData.user_id,
      searchConstraints,
    });
  }
}
