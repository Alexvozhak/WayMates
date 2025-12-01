import { z } from "zod";

import {
  storyInputSchema,
  trailSchema,
  upsertStoryResultSchema,
  userContextSchema,
  userIdSchema,
} from "../../shared/schemas.js";

import { publicProcedure, t } from "./trpc.js";

export const storyRouter = t.router({
  upsertStory: publicProcedure
    .input(storyInputSchema)
    .output(upsertStoryResultSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.storyManager.upsertStory(input);
    }),

  getStory: publicProcedure
    .input(
      z.object({
        userId: userIdSchema,
      }),
    )
    .output(
      z.object({
        contexts: z.array(userContextSchema),
        trails: z.array(trailSchema),
      }),
    )
    .query(async ({ ctx, input }) => {
      const story = await ctx.storyManager.getUserStory(input.userId);
      return {
        contexts: story.contexts,
        trails: story.trails,
      };
    }),

  deleteStory: publicProcedure
    .input(
      z.object({
        userId: userIdSchema,
      }),
    )
    .output(
      z.object({
        deletedContexts: z.number(),
        deletedTrails: z.number(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.storyManager.deleteStory(input.userId);
    }),
});
