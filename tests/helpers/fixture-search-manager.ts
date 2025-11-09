import { Driver } from "neo4j-driver";
import { DatabaseContext } from "../../src/database-context.js";
import { SearchManager } from "../../src/core/search-manager.js";
import { PersistenceManager } from "../../src/persistence-manager.js";
import { SelectivityService } from "../../src/services/selectivity.service.js";
import { TrajectorySimilarityService } from "../../src/core/trajectory-similarity.service.js";
import { PathCollectorService } from "../../src/core/path-collector.service.js";
import { GoalsManager } from "../../src/core/goals-manager.js";

export class FixtureSearchManager {
  private searchManager: SearchManager;
  private persistenceManager: PersistenceManager;

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
      goalsManager
    );
    this.persistenceManager = new PersistenceManager(db);
  }

  getSearchManager(): SearchManager {
    return this.searchManager;
  }

  getPersistenceManager(): PersistenceManager {
    return this.persistenceManager;
  }
}
