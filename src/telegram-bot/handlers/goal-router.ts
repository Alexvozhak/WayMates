import { extractSubcommand } from "./command-parser.js";
import { handleDeleteGoal } from "./delete-goal.js";
import { handleGetGoal } from "./get-goal.js";
import { handleSetGoal } from "./set-goal.js";

import type { BotContext } from "../types.js";

export async function handleGoal(ctx: BotContext): Promise<void> {
  const subcommand = extractSubcommand(ctx);

  if (subcommand === "set") {
    await handleSetGoal(ctx);
    return;
  }

  if (subcommand === "delete") {
    await handleDeleteGoal(ctx);
    return;
  }

  if (subcommand === "" || !subcommand) {
    await handleGetGoal(ctx);
    return;
  }

  await ctx.reply(ctx.t("action-required"));
}
