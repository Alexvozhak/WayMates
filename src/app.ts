import {
  createDriver as createNeo4jDriver,
  verifyConnection,
} from "./neo4j.js";
import { createWayMatesServer } from "./mcp-server.js";
import { SearchQueryBuilder } from "./orcestrator/search-query-builder.js";
import { SearchManager } from "./search-manager.js";
import { PersistenceManager } from "./persistence-manager.js";
import { SkillCategoriesManager } from "./skill-categories-manager.js";
import { SelectivityService } from "./services/selectivity.service.js";

async function main() {
  const searchQueryBuilder = new SearchQueryBuilder();
  searchQueryBuilder.validateCurrentPresets();

  const driver = createNeo4jDriver(); //todo нужен ли trycatch?
  // и нужно разобраться как работаем с енв, централизовано
  await verifyConnection(driver);

  const selectivityService = new SelectivityService(driver);
  const searchManager = new SearchManager(driver, searchQueryBuilder, selectivityService);
  const persistenceManager = new PersistenceManager(driver);
  const skillCategoriesManager = new SkillCategoriesManager(driver);
  const server = createWayMatesServer(searchManager, persistenceManager, skillCategoriesManager);

  await server.start({
    transportType: "stdio",
  });

  console.log("🚀 WayMates MCP Server started successfully");
}

main().catch(console.error);
