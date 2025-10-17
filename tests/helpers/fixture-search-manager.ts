import { Driver } from "neo4j-driver";

import { SearchQueryBuilder } from "../../src/orcestrator/search-query-builder.js";
import { SearchManager } from "../../src/search-manager.js";

import {
  CurrentOnlyParamsSchema,
  UserContextSchema,
  TargetContextSchema,
  SearchConstraints,
  SearchResult,
  CurrentOnlyResult,
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

  async runCurrentOnlyMode(
    userKey: UserKey,
    otherUserKeys: UserKey[],
    currentPreset: string,
    stepSizeMonths = 6,
    numberOfSteps = 2,
    includeFinalBatch = true,
    searchConstraints = DEFAULT_CONSTRAINTS,
    reasonsToTrack = ["position_changed"]
  ): Promise<CurrentOnlyResult[]> {
    const userData = this.testDataManager.getStoryBy(userKey);
    await this.persistenceManager.upsertStory(userData);

    for (const otherUserKey of otherUserKeys) {
      const otherUserData = this.testDataManager.getStoryBy(otherUserKey);
      await this.persistenceManager.upsertStory(otherUserData);
    }

    const currentContext = UserContextSchema.parse(userData.contexts[0]);

    const params = CurrentOnlyParamsSchema.parse({
      currentUserId: userData.user_id,
      currentPreset,
      currentContext,
      stepSizeMonths,
      numberOfSteps,
      includeFinalBatch,
      searchConstraints,
      reasonsToTrack,
    });

    return this.searchManager.searchInCurrentOnlyMode(params);
  }

  async runPipeline(
    userKey: UserKey,
    otherUserKeys: UserKey[],
    currentPreset: string,
    targetPreset: string,
    searchConstraints: SearchConstraints
  ): Promise<SearchResult[]> {
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

  async runCurrent(
    userKey: UserKey,
    otherUserKeys: UserKey[],
    presetName: string,
    searchConstraints: SearchConstraints
  ): Promise<SearchResult[]> {
    const userData = this.testDataManager.getStoryBy(userKey);
    await this.persistenceManager.upsertStory(userData);

    for (const otherUserKey of otherUserKeys) {
      const otherUserData = this.testDataManager.getStoryBy(otherUserKey);
      await this.persistenceManager.upsertStory(otherUserData);
    }

    const currentContext = UserContextSchema.parse(userData.contexts[0]);

    return this.searchManager.searchCurrentContext(
      presetName,
      currentContext,
      userData.user_id,
      searchConstraints
    );
  }

  async runTargetContext(
    userKey: UserKey,
    otherUserKeys: UserKey[],
    presetName: string,
    searchConstraints: SearchConstraints
  ): Promise<SearchResult[]> {
    const userData = this.testDataManager.getStoryBy(userKey);
    await this.persistenceManager.upsertStory(userData);

    for (const otherUserKey of otherUserKeys) {
      const otherUserData = this.testDataManager.getStoryBy(otherUserKey);
      await this.persistenceManager.upsertStory(otherUserData);
    }

    const targetContext = TargetContextSchema.parse(
      userData.contexts[userData.contexts.length - 1]
    );

    return this.searchManager.searchTargetContext(
      presetName,
      targetContext,
      userData.user_id,
      searchConstraints
    );
  }
}
