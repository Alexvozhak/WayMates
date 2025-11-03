import type { Driver } from "neo4j-driver";
import { DatabaseContext } from "../../src/database-context.js";
import { TestDataManager, type UserKey } from "./test-data-manager.js";
import { PersistenceManager } from "../../src/persistence-manager.js";

export class FixturePersistenceManager {
  constructor(
    driver: Driver,
    protected persistenceManager: PersistenceManager,
    protected testDataManager: TestDataManager
  ) {
    const db = new DatabaseContext(driver);
    this.persistenceManager = new PersistenceManager(db);
    this.testDataManager = new TestDataManager();
  }

  async upsertStory(userKey: UserKey) {
    const testData = this.testDataManager.getStoryBy(userKey);
    const result = await this.persistenceManager.upsertStory(testData);
    return { testData, result };
  }

  async upsertContext(userKey: UserKey, contextIndex: number) {
    const testData = this.testDataManager.getStoryBy(userKey);
    const context = testData.contexts[contextIndex]!;
    const result = await this.persistenceManager.upsertContexts({
      user_id: testData.user_id,
      contexts: [context],
    });
    return {
      testData,
      result,
      context,
      userId: testData.user_id,
      contextId: context.context_id,
    };
  }

  async upsertTrail(userKey: UserKey, trailIndex: number) {
    const testData = this.testDataManager.getStoryBy(userKey);
    const trail = testData.trails[trailIndex]!;
    const result = await this.persistenceManager.upsertTrails({
      user_id: testData.user_id,
      trails: [trail],
    });
    return {
      testData,
      result,
      trail,
      userId: testData.user_id,
      trailId: result.trailIds?.[0],
    };
  }

  async upsertContexts(userKey: UserKey, contextIndices: number[]) {
    const testData = this.testDataManager.getStoryBy(userKey);
    const contexts = contextIndices.map((i) => testData.contexts[i]!);
    const result = await this.persistenceManager.upsertContexts({
      user_id: testData.user_id,
      contexts,
    });
    return { testData, result, contexts };
  }

  async upsertTrails(userKey: UserKey, trailIndices: number[]) {
    const testData = this.testDataManager.getStoryBy(userKey);
    const trails = trailIndices.map((i) => testData.trails[i]!);
    const result = await this.persistenceManager.upsertTrails({
      user_id: testData.user_id,
      trails,
    });
    return { testData, result, trails };
  }

  getTestData(userKey: UserKey) {
    return this.testDataManager.getStoryBy(userKey);
  }

  getContext(userKey: UserKey, contextIndex: number) {
    const testData = this.testDataManager.getStoryBy(userKey);
    return testData.contexts[contextIndex];
  }

  getTrail(userKey: UserKey, trailIndex: number) {
    const testData = this.testDataManager.getStoryBy(userKey);
    return testData.trails[trailIndex];
  }
}
