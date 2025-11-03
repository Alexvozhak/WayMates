import { Driver } from "neo4j-driver";
import { DatabaseContext } from "../../src/database-context.js";
import { SearchManager } from "../../src/search-manager.js";
import { PersistenceManager } from "../../src/persistence-manager.js";
import { SelectivityService } from "../../src/services/selectivity.service.js";

export class FixtureSearchManager {
  private searchManager: SearchManager;
  private persistenceManager: PersistenceManager;

  constructor(driver: Driver) {
    const db = new DatabaseContext(driver);
    const selectivity = new SelectivityService(db);

    this.searchManager = new SearchManager(db, selectivity);
    this.persistenceManager = new PersistenceManager(db);
  }

  getSearchManager(): SearchManager {
    return this.searchManager;
  }

  getPersistenceManager(): PersistenceManager {
    return this.persistenceManager;
  }
}
