import { DatabaseContext } from '../database-context.js';
import { createDriver, verifyConnection } from '../neo4j.js';
import { SelectivityService } from '../services/selectivity.service.js';

import { GoalsManager } from './goals-manager.js';
import { PathCollectorService } from './path-collector.service.js';
import { startRestServer } from './rest-server.js';
import { SearchManager } from './search-manager.js';
import { StoryManager } from './story-manager.js';
import { TrajectorySimilarityService } from './trajectory-similarity.service.js';

async function main(): Promise<void> {
  const driver = createDriver();
  await verifyConnection(driver);

  const db = new DatabaseContext(driver);

  const selectivityService = new SelectivityService(db);
  const trajectorySimilarity = new TrajectorySimilarityService();
  const pathCollector = new PathCollectorService(db);
  const storyManager = new StoryManager(db);
  const goalsManager = new GoalsManager(db);
  const searchManager = new SearchManager(
    db,
    selectivityService,
    trajectorySimilarity,
    pathCollector,
    goalsManager
  );

  const port = Number(process.env.CORE_PORT) || 9000;
  const host = process.env.CORE_HOST || '0.0.0.0';

  await startRestServer(
    {
      searchManager,
      storyManager,
      goalsManager,
    },
    port,
    host
  );
}

await main();
