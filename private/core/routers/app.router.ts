import { contextRouter } from "./context.router.js";
import { dictionariesRouter } from "./dictionaries.router.js";
import { goalRouter } from "./goal.router.js";
import { searchRouter } from "./search.router.js";
import { storyRouter } from "./story.router.js";
import { trailRouter } from "./trail.router.js";
import { t } from "./trpc.js";
import { userRouter } from "./user.router.js";

export const appRouter = t.router({
  search: searchRouter,
  story: storyRouter,
  goal: goalRouter,
  dictionaries: dictionariesRouter,
  context: contextRouter,
  trail: trailRouter,
  user: userRouter,
});

export type AppRouter = typeof appRouter;
