import { initSentry } from "@shared/sentry.js";

import { DatabaseContext } from "./database-context.js";
import { DictionariesManager } from "./dictionaries-manager.js";
import { config } from "./env.js";
import { GoalsManager } from "./goals-manager.js";
import { createDriver, verifyConnection } from "./neo4j.js";
import { PathCollectorService } from "./path-collector.service.js";
import { SearchManager } from "./search-manager.js";
import { SelectivityService } from "./selectivity.service.js";
import { StoryManager } from "./story-manager.js";
import { TrajectorySimilarityService } from "./trajectory-similarity.service.js";
import { startTRPCServer } from "./trpc-server.js";

initSentry({ dsn: config.SENTRY_DSN, environment: config.NODE_ENV, service: "core" });

async function main(): Promise<void> {
  const driver = createDriver();
  await verifyConnection(driver);

  const db = new DatabaseContext(driver);

  const selectivityService = new SelectivityService(db);
  const trajectorySimilarity = new TrajectorySimilarityService();
  const pathCollector = new PathCollectorService(db);
  const storyManager = new StoryManager(db);
  const goalsManager = new GoalsManager(db);
  const dictionariesManager = new DictionariesManager(db);
  const searchManager = new SearchManager(db, selectivityService, trajectorySimilarity, pathCollector, goalsManager);

  startTRPCServer(
    {
      searchManager,
      storyManager,
      goalsManager,
      dictionariesManager,
    },
    config.CORE_PORT,
    config.CORE_HOST,
  );
}

await main();
