import {
  createDriver as createNeo4jDriver,
  verifyConnection,
} from "./neo4j.js";
import { createWayMatesServer } from "./mcp-server.js";
import { SearchManager } from "./search-manager.js";
import { PersistenceManager } from "./persistence-manager.js";
import { SkillCategoriesManager } from "./skill-categories-manager.js";
import { SelectivityService } from "./services/selectivity.service.js";
import { GdsProjectionService } from "./gds/services/gds-projection.service.js";
import { GdsSimilarityService } from "./gds/services/gds-similarity.service.js";
import { GdsPathfindingService } from "./gds/services/gds-pathfinding.service.js";

async function main() {
  const driver = createNeo4jDriver();
  await verifyConnection(driver);

  const selectivityService = new SelectivityService(driver);

  const gdsProjectionService = new GdsProjectionService(driver);
  const gdsSimilarityService = new GdsSimilarityService(driver, gdsProjectionService);
  const gdsPathfindingService = new GdsPathfindingService(driver, gdsProjectionService);

  const searchManager = new SearchManager(
    driver,
    selectivityService,
    gdsSimilarityService,
    gdsPathfindingService,
    gdsProjectionService
  );
  const persistenceManager = new PersistenceManager(driver);
  const skillCategoriesManager = new SkillCategoriesManager(driver);
  const server = createWayMatesServer(searchManager, persistenceManager, skillCategoriesManager);

  await server.start({
    transportType: "stdio",
  });

  console.log("🚀 WayMates MCP Server started successfully");
}

main().catch(console.error);
