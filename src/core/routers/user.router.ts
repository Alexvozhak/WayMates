import { z } from "zod";

import { userIdSchema, userStateSchema } from "../../shared/schemas.js";

import { publicProcedure, t } from "./trpc.js";

export const userRouter = t.router({
  getState: publicProcedure
    .input(
      z.object({
        userId: userIdSchema,
      }),
    )
    .output(userStateSchema)
    .query(async ({ ctx, input }) => {
      const [story, goal] = await Promise.all([
        ctx.storyManager.getUserStory(input.userId),
        ctx.goalsManager.getUserGoal(input.userId),
      ]);

      return {
        hasContext: story.contexts.length > 0,
        hasGoal: goal !== null,
      };
    }),
});
