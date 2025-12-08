import { transcribeVoice } from "../services/whisper.js";

import { routeInput } from "./input-router.js";

import type { BotContext } from "../types.js";

export async function handleVoice(ctx: BotContext): Promise<void> {
  const fileId = ctx.message?.voice?.file_id;
  if (!fileId) {
    return;
  }

  const text = await transcribeVoice(ctx, fileId);
  await routeInput(ctx, text);
}
