import { z } from "zod";

import { createGoalInputSchema, goalSchema, userIdSchema } from "../../shared/schemas.js";

import { publicProcedure, t } from "./trpc.js";

export const goalRouter = t.router({
  set: publicProcedure
    .input(createGoalInputSchema)
    .output(
      z.object({
        goalId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = await ctx.goalsManager.setGoal(input);
      return { goalId: userId };
    }),

  getByUser: publicProcedure
    .input(
      z.object({
        userId: userIdSchema,
      }),
    )
    .output(goalSchema.nullable())
    .query(async ({ ctx, input }) => {
      return ctx.goalsManager.getUserGoal(input.userId);
    }),

  delete: publicProcedure
    .input(
      z.object({
        userId: userIdSchema,
      }),
    )
    .output(z.void())
    .mutation(async ({ ctx, input }) => {
      await ctx.goalsManager.deleteGoal(input.userId);
    }),
});
