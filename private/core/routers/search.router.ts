import {
  matchedCandidateWithPathSchema,
  pathfinderCandidateSchema,
  pathfinderSearchParamsSchema,
  targetSearchParamsSchema,
  waymateCandidateSchema,
  waymatesSearchParamsSchema,
} from "@shared/schemas.js";
import { z } from "zod";


import { publicProcedure, t } from "./trpc.js";

export const searchRouter = t.router({
  waymates: publicProcedure
    .input(waymatesSearchParamsSchema)
    .output(z.array(waymateCandidateSchema))
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
