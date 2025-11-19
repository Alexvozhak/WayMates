import { updateContextParamsSchema, userContextSchema } from "../../shared/schemas.js";

import { publicProcedure, t } from "./trpc.js";

export const contextRouter = t.router({
  update: publicProcedure
    .input(updateContextParamsSchema)
    .output(userContextSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.storyManager.updateContext(input);
    }),
});
