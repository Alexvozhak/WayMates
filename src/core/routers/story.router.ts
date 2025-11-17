import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  contextIdSchema,
  storyInputSchema,
  trailIdSchema,
  trailSchema,
  upsertStoryResultSchema,
  userContextSchema,
  userIdSchema,
} from "../../shared/schemas.js";

import { publicProcedure, t } from "./trpc.js";

export const storyRouter = t.router({
  upsert: publicProcedure
    .input(storyInputSchema)
    .output(upsertStoryResultSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.storyManager.upsertStory(input);
    }),

  getByUser: publicProcedure
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
      return ctx.storyManager.getUserStory(input.userId);
    }),

  context: t.router({
    update: publicProcedure
      .input(
        z.object({
          userId: userIdSchema,
          contextId: contextIdSchema,
          updates: z.any(),
        }),
      )
      .output(userContextSchema)
      .mutation(() => {
        throw new TRPCError({
          code: "NOT_IMPLEMENTED",
          message: "StoryManager.updateContext() method not yet implemented",
        });
      }),

    delete: publicProcedure
      .input(
        z.object({
          userId: userIdSchema,
          contextId: contextIdSchema,
        }),
      )
      .output(z.void())
      .mutation(async ({ ctx, input }) => {
        await ctx.storyManager.deleteContext(input.userId, input.contextId);
      }),
  }),

  trail: t.router({
    delete: publicProcedure
      .input(
        z.object({
          userId: userIdSchema,
          trailId: trailIdSchema,
        }),
      )
      .output(z.void())
      .mutation(async ({ ctx, input }) => {
        await ctx.storyManager.deleteTrail(input.userId, input.trailId);
      }),
  }),
});
