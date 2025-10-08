import { createDriver } from "./neo4j.js";
import { createWayMatesServer } from "./mcp-server.js";
import { PresetsManager } from "./orcestrator/preset-manager.js";
import { join } from "path";

const PRESETS_PATH = join(process.cwd(), "config", "presets.json");

async function main() {
  const driver = await createDriver();

  try {
    const presetsManager = new PresetsManager(PRESETS_PATH);

    const server = createWayMatesServer(driver, presetsManager);

    await server.start({
      transportType: "stdio",
    });

    console.log("🚀 WayMates MCP Server started successfully");
  } catch (error) {
    console.error("❌ Failed to start application:", error);
    await driver.close();
    process.exit(1);
  }
}

main().catch(console.error);
