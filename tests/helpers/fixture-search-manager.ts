import { Driver } from "neo4j-driver";
import { SearchManager } from "../../src/search-manager.js";
import { PersistenceManager } from "../../src/persistence-manager.js";
import { SelectivityService } from "../../src/services/selectivity.service.js";
import { GdsProjectionService } from "../../src/gds/services/gds-projection.service.js";
import { GdsSimilarityService } from "../../src/gds/services/gds-similarity.service.js";
import { GdsPathfindingService } from "../../src/gds/services/gds-pathfinding.service.js";

export class FixtureSearchManager {
  private searchManager: SearchManager;
  private persistenceManager: PersistenceManager;

  constructor(driver: Driver) {
    const selectivity = new SelectivityService(driver);
    const gdsProjection = new GdsProjectionService(driver);
    const gdsSimilarity = new GdsSimilarityService(driver, gdsProjection);
    const gdsPathfinding = new GdsPathfindingService(driver, gdsProjection);

    this.searchManager = new SearchManager(
      driver,
      selectivity,
      gdsSimilarity,
      gdsPathfinding,
      gdsProjection
    );
    this.persistenceManager = new PersistenceManager(driver);
  }
}
