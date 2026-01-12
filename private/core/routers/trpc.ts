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

// eslint-disable-next-line complexity -- simple value summarization for logging
function summarizeInput(input: unknown): unknown {
  if (input == null) return null;
  if (typeof input !== "object") return input;
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- safe after typeof check
  const obj = input as Record<string, unknown>;
  const summary: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (Array.isArray(value)) {
      summary[key] = `[${value.length} items]`;
    } else if (typeof value === "object" && value !== null) {
      summary[key] = "{...}";
    } else if (typeof value === "string" && value.length > 100) {
      summary[key] = value.slice(0, 100) + "...";
    } else {
      summary[key] = value;
    }
  }
  return summary;
}

const timingMiddleware = t.middleware(async (opts) => {
  const start = Date.now();
  logger.info({ path: opts.path, type: opts.type, input: summarizeInput(opts.getRawInput()) }, "tRPC started");

  const result = await opts.next();
  const durationMs = Date.now() - start;

  if (result.ok) {
    logger.info({ path: opts.path, type: opts.type, durationMs }, "tRPC completed");
  } else {
    logger.error({ path: opts.path, type: opts.type, durationMs, err: result.error }, "tRPC failed");
  }

  return result;
});

export const publicProcedure = t.procedure.use(timingMiddleware);
