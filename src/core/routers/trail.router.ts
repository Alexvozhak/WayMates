import { z } from "zod";

import { trailIdSchema, upsertTrailInputSchema, userIdSchema } from "../../shared/schemas.js";
import { upsertSingleTrailResultSchema } from "../schemas.js";

import { publicProcedure, t } from "./trpc.js";

export const trailRouter = t.router({
  upsert: publicProcedure
    .input(upsertTrailInputSchema)
    .output(upsertSingleTrailResultSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.storyManager.upsertTrail(input);
    }),

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
});
