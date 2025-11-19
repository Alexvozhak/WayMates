import { z } from "zod";

import { addTermInputSchema, dictionariesSchema } from "../../shared/schemas.js";

import { publicProcedure, t } from "./trpc.js";

export const dictionariesRouter = t.router({
  getVerified: publicProcedure
    .input(z.void())
    .output(dictionariesSchema)
    .query(async ({ ctx }) => {
      return ctx.dictionariesManager.getVerifiedDictionaries();
    }),

  addTerm: publicProcedure
    .input(addTermInputSchema)
    .output(z.void())
    .mutation(async ({ ctx, input }) => {
      await ctx.dictionariesManager.addTerm(input);
    }),
});
