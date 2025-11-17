import { goalRouter } from "./goal.router.js";
import { searchRouter } from "./search.router.js";
import { storyRouter } from "./story.router.js";
import { t } from "./trpc.js";

export const appRouter = t.router({
  search: searchRouter,
  story: storyRouter,
  goal: goalRouter,
});

export type AppRouter = typeof appRouter;
