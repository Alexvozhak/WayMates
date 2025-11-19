import { dictionariesRouter } from "./dictionaries.router.js";
import { goalRouter } from "./goal.router.js";
import { searchRouter } from "./search.router.js";
import { storyRouter } from "./story.router.js";
import { t } from "./trpc.js";

export const appRouter = t.router({
  search: searchRouter,
  story: storyRouter,
  goal: goalRouter,
  dictionaries: dictionariesRouter,
});

export type AppRouter = typeof appRouter;
