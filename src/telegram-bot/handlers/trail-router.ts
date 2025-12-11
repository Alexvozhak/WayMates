import { handleAddTrail } from "./add-trail.js";
import { extractSubcommand } from "./command-parser.js";
import { handleDeleteTrail } from "./delete-trail.js";

import type { BotContext } from "../types.js";

export async function handleTrail(ctx: BotContext): Promise<void> {
  const subcommand = extractSubcommand(ctx);

  if (subcommand === "add") {
    await handleAddTrail(ctx);
    return;
  }

  if (subcommand === "delete") {
    await handleDeleteTrail(ctx);
    return;
  }

  await ctx.reply(ctx.t("action-required"));
}
