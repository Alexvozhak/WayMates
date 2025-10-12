import type { Driver } from "neo4j-driver";
import type {
  StoryInput,
  UserIdContext,
  UserIdTrail,
  GetUserStoryParams,
  DeleteContextParams,
  DeleteTrailParams,
} from "./schemas-zod.js";
import {
  executeUpsertStory,
  executeUpsertContexts,
  executeUpsertTrails,
} from "./upsert-story.js";
import {
  getUserStory,
  deleteContext,
  deleteTrail,
  pingDatabase,
} from "./mcp-tools.js";

/**
 * Create a persistence facade for write operations.
 */
export function createPersistenceManager(driver: Driver) {
  return {
    upsertStory: (params: StoryInput) => executeUpsertStory(driver, params),
    upsertContexts: (params: UserIdContext) => executeUpsertContexts(driver, params),
    upsertTrails: (params: UserIdTrail) => executeUpsertTrails(driver, params),
    getUserStory: (params: GetUserStoryParams) => getUserStory(driver, params),
    deleteContext: (params: DeleteContextParams) => deleteContext(driver, params),
    deleteTrail: (params: DeleteTrailParams) => deleteTrail(driver, params),
    ping: () => pingDatabase(driver),
  };
}
export type PersistenceManager = ReturnType<typeof createPersistenceManager>;
