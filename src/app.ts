import { createDriver } from "./neo4j.js";
import { createWayMatesServer } from "./mcp-server.js";
import { PresetsManager } from "./orcestrator/preset-manager.js";
import { join } from "path";
import { QueryOrchestrator } from "./orcestrator/query-orchestrator.js";
import { SearchManager } from "./search-manager.js";

const PRESETS_PATH = join(process.cwd(), "config", "presets.json");

async function main() {
  // 1. Initialize Neo4j driver
  const driver = await createDriver();
  // 2. Load presets
  const presetsManager = new PresetsManager(PRESETS_PATH);
  presetsManager.load();
  // 3. Initialize orchestrator and validate presets
  const orchestrator = new QueryOrchestrator(presetsManager);
  orchestrator.validateCurrentPresets();
  // 4. Create search manager facade
  const searchManager = new SearchManager(driver, orchestrator);
  const server = createWayMatesServer(searchManager);

  await server.start({
    transportType: "stdio",
  });

  console.log("🚀 WayMates MCP Server started successfully");
}

main().catch(console.error);
