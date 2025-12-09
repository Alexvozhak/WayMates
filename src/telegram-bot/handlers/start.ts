import { PresenterError } from "../errors.js";
import { logger } from "../logger.js";

import type { BotContext } from "../types.js";

export async function handleStart(ctx: BotContext): Promise<void> {
  try {
    const welcomeMsg = await ctx.services.welcomePresenter.format(
      {
        hasStory: ctx.session.status === "initialised" ? ctx.session.hasStory : false,
        userName: ctx.from?.first_name,
      },
      ctx.from?.language_code,
    );
    await ctx.reply(welcomeMsg);
  } catch (error) {
    logger.error({ err: error }, "Failed to generate welcome message");
    throw new PresenterError("Failed to generate welcome message", error instanceof Error ? error : undefined);
  }
}
