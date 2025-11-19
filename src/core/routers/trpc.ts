import { initTRPC } from "@trpc/server";

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

export const publicProcedure = t.procedure;
