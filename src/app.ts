import {
  createDriver as createNeo4jDriver,
  verifyConnection,
} from "./neo4j.js";
import { createWayMatesServer } from "./mcp-server.js";
import { PresetsManager } from "./orcestrator/preset-manager.js";
import { SearchQueryBuilder } from "./orcestrator/search-query-builder.js";
import { SearchManager } from "./search-manager.js";
import { PersistenceManager } from "./persistence-manager.js";
import { PRESETS_PATH } from "./config.js";

async function main() {
  const presetsManager = new PresetsManager(PRESETS_PATH);
  presetsManager.load();

  const searchQueryBuilder = new SearchQueryBuilder(presetsManager);
  searchQueryBuilder.validateCurrentPresets();

  const driver = createNeo4jDriver(); //todo нужен ли trycatch?
  // и нужно разобраться как работаем с енв, централизовано
  await verifyConnection(driver);

  const searchManager = new SearchManager(driver, searchQueryBuilder);
  const persistenceManager = new PersistenceManager(driver);
  const server = createWayMatesServer(searchManager, persistenceManager);

  await server.start({
    transportType: "stdio",
  });

  console.log("🚀 WayMates MCP Server started successfully");
}

main().catch(console.error);
