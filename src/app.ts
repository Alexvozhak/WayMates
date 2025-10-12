import {
  createDriver as createNeo4jDriver,
  verifyConnection,
} from "./neo4j.js";
import { createWayMatesServer } from "./mcp-server.js";
import { PresetsManager } from "./orcestrator/preset-manager.js";
import { join } from "path";
import { QueryOrchestrator } from "./orcestrator/query-orchestrator.js";
import { SearchManager } from "./search-manager.js";
import { createPersistenceManager } from "./persistence-manager.js";

const PRESETS_PATH = join(process.cwd(), "config", "presets.json");

async function main() {
  const presetsManager = new PresetsManager(PRESETS_PATH);
  presetsManager.load();

  const orchestrator = new QueryOrchestrator(presetsManager);
  orchestrator.validateCurrentPresets();

  const driver = createNeo4jDriver(); //todo нужен ли trycatch?
  // и нужно разобраться как работаем с енв, централизовано
  await verifyConnection(driver);

  const searchManager = new SearchManager(driver, orchestrator);
  const persistenceManager = createPersistenceManager(driver);
  const server = createWayMatesServer(searchManager, persistenceManager);

  await server.start({
    transportType: "stdio",
  });

  console.log("🚀 WayMates MCP Server started successfully");
}

main().catch(console.error);
