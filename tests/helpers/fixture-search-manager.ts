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

export class FixtureSearchManager {
  private searchManager: SearchManager;
  private persistenceManager: PersistenceManager;
  private testDataManager: TestDataManager;

  constructor(driver: Driver) {
    const builder = new SearchQueryBuilder();
    const selectivity = new SelectivityService(driver);
    this.searchManager = new SearchManager(driver, builder, selectivity);
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

    return this.searchManager.searchPipeline(
      currentPreset,
      currentContext,
      targetPreset,
      targetContext,
      userData.user_id,
      searchConstraints
    );
  }
}
