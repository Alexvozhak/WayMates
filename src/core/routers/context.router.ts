import { z } from "zod";

import {
  contextIdSchema,
  coreUpdateContextParamsSchema,
  upsertContextInputSchema,
  userContextSchema,
  userIdSchema,
} from "../../shared/schemas.js";
import { upsertSingleContextResultSchema } from "../schemas.js";

import { publicProcedure, t } from "./trpc.js";

export const contextRouter = t.router({
  upsertContext: publicProcedure
    .input(upsertContextInputSchema)
    .output(upsertSingleContextResultSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.storyManager.upsertContext(input);
    }),

  update: publicProcedure
    .input(coreUpdateContextParamsSchema)
    .output(userContextSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.storyManager.updateContext(input);
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
});
