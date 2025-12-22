import { initTRPC } from "@trpc/server";

import { logger } from "../logger.js";

import type { DictionariesManager } from "../dictionaries-manager.js";
import type { GoalsManager } from "../goals-manager.js";
import type { SearchManager } from "../search-manager.js";
import type { StoryManager } from "../story-manager.js";

export type CoreContext = {
  searchManager: SearchManager;
  storyManager: StoryManager;
  goalsManager: GoalsManager;
  dictionariesManager: DictionariesManager;
};

export const t = initTRPC.context<CoreContext>().create();

const timingMiddleware = t.middleware(async (opts) => {
  const start = Date.now();
  const result = await opts.next();
  const durationMs = Date.now() - start;

  if (result.ok) {
    logger.info({ path: opts.path, type: opts.type, durationMs }, "tRPC completed");
  } else {
    logger.error({ path: opts.path, type: opts.type, durationMs }, "tRPC failed");
  }

  return result;
});

export const publicProcedure = t.procedure.use(timingMiddleware);
