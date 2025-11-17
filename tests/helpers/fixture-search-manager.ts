import type { Driver } from "neo4j-driver";
import { DatabaseContext } from "../../src/database-context.js";
import { GoalsManager } from "../../src/core/goals-manager.js";
import { PathCollectorService } from "../../src/core/path-collector.service.js";
import { SearchManager } from "../../src/core/search-manager.js";
import { SelectivityService } from "../../src/core/selectivity.service.js";
import { StoryManager } from "../../src/core/story-manager.js";
import { TrajectorySimilarityService } from "../../src/core/trajectory-similarity.service.js";
import type { UserSearchParams } from "../../src/shared/schemas.js";

export class FixtureSearchManager {
  private searchManager: SearchManager;
  private storyManager: StoryManager;

  constructor(driver: Driver) {
    const db = new DatabaseContext(driver);
    const selectivity = new SelectivityService(db);
    const trajectorySimilarity = new TrajectorySimilarityService();
    const pathCollector = new PathCollectorService(db);
    const goalsManager = new GoalsManager(db);

    this.searchManager = new SearchManager(
      db,
      selectivity,
      trajectorySimilarity,
      pathCollector,
      goalsManager,
    );
    this.storyManager = new StoryManager(db);
  }

  getSearchManager(): SearchManager {
    return this.searchManager;
  }

  getStoryManager(): StoryManager {
    return this.storyManager;
  }
}

export const createUserSearchParams = (
  userId: string,
  overrides?: Partial<UserSearchParams>,
): UserSearchParams => ({
  userId,
  limit: 10,
  pathLimit: 10,
  excludedContextFields: [],
  excludedCreationReasons: [],
  ...overrides,
});
