import {
  createDriver as createNeo4jDriver,
  verifyConnection,
} from "./neo4j.js";
import { DatabaseContext } from "./database-context.js";
import { createWayMatesServer } from "./mcp-server.js";
import { SearchManager } from "./search-manager.js";
import { PersistenceManager } from "./persistence-manager.js";
import { SkillCategoriesManager } from "./skill-categories-manager.js";
import { SelectivityService } from "./services/selectivity.service.js";

async function main() {
  const driver = createNeo4jDriver();
  await verifyConnection(driver);

  const db = new DatabaseContext(driver);
  const selectivityService = new SelectivityService(db);
  const searchManager = new SearchManager(db, selectivityService);
  const persistenceManager = new PersistenceManager(db);
  const skillCategoriesManager = new SkillCategoriesManager(db);

  const server = createWayMatesServer(searchManager, persistenceManager, skillCategoriesManager);

  await server.start({
    transportType: "stdio",
  });

  console.log("🚀 WayMates MCP Server started successfully");
}

main().catch(console.error);
