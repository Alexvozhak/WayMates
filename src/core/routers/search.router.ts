import { z } from "zod";

import {
  matchedCandidateWithPathSchema,
  pathfinderCandidateSchema,
  pathfinderSearchParamsSchema,
  scoredMatchedCandidateSchema,
  targetSearchParamsSchema,
  waymatesSearchParamsSchema,
} from "../../shared/schemas.js";

import { publicProcedure, t } from "./trpc.js";

export const searchRouter = t.router({
  waymates: publicProcedure
    .input(waymatesSearchParamsSchema)
    .output(z.array(scoredMatchedCandidateSchema))
    .query(async ({ ctx, input }) => {
      return ctx.searchManager.searchWaymates(input);
    }),

  reversePathfinders: publicProcedure
    .input(targetSearchParamsSchema)
    .output(z.array(matchedCandidateWithPathSchema))
    .query(async ({ ctx, input }) => {
      return ctx.searchManager.reverseSearchPathfinders(input);
    }),

  pathfinders: publicProcedure
    .input(pathfinderSearchParamsSchema)
    .output(z.array(pathfinderCandidateSchema))
    .query(async ({ ctx, input }) => {
      return ctx.searchManager.searchPathfinders(input);
    }),
});
