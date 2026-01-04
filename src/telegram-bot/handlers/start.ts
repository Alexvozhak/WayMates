import { PresenterError } from "../errors.js";

import type { BotContext } from "../types.js";

export async function handleStart(ctx: BotContext): Promise<void> {
  try {
    // Clear all active graph checkpoints to ensure clean state
    const sessionId = await ctx.services.sessionService.getSessionId(ctx);
    await ctx.services.mcpClient.callTool("cancel_all_graphs", {
      sessionId,
      requestId: ctx.requestId,
    });

    const welcomeMsg = await ctx.services.welcomePresenter.format(
      {
        hasStory: false,
        userName: ctx.from?.first_name,
      },
      ctx.from?.language_code,
    );
    await ctx.reply(welcomeMsg);
  } catch (error) {
    ctx.services.logger.error({ err: error }, "Failed to generate welcome message");
    throw new PresenterError("Failed to generate welcome message", error instanceof Error ? error : undefined);
  }
}
