import { handleAddContext } from "./add-context.js";
import { extractSubcommand } from "./command-parser.js";
import { handleDeleteContext } from "./delete-context.js";
import { handleUpdateContext } from "./update-context.js";

import type { BotContext } from "../types.js";

export async function handleContext(ctx: BotContext): Promise<void> {
  const subcommand = extractSubcommand(ctx);

  if (subcommand === "update") {
    await handleUpdateContext(ctx);
    return;
  }

  if (subcommand === "add") {
    await handleAddContext(ctx);
    return;
  }

  if (subcommand === "delete") {
    await handleDeleteContext(ctx);
    return;
  }

  await ctx.reply(ctx.t("action-required"));
}
