import { z } from "zod";

import {
  adhocSearchParamsSchema,
  matchedCandidateWithPathSchema,
  scoredMatchedCandidateSchema,
  targetSearchParamsSchema,
  userSearchParamsBaseSchema,
} from "../../shared/schemas.js";

import { publicProcedure, t } from "./trpc.js";

export const searchRouter = t.router({
  adhoc: publicProcedure
    .input(adhocSearchParamsSchema)
    .output(z.array(scoredMatchedCandidateSchema))
    .query(async ({ ctx, input }) => {
      return ctx.searchManager.searchAdhoc(input);
    }),

  byUser: publicProcedure
    .input(userSearchParamsBaseSchema)
    .output(z.array(scoredMatchedCandidateSchema))
    .query(async ({ ctx, input }) => {
      return ctx.searchManager.searchByUser(input);
    }),

  byTarget: publicProcedure
    .input(targetSearchParamsSchema)
    .output(z.array(matchedCandidateWithPathSchema))
    .query(async ({ ctx, input }) => {
      return ctx.searchManager.searchByTarget(input);
    }),
});
