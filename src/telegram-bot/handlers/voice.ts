import { formatResponse } from "../presenters/format-response.js";
import { transcribeVoice } from "../services/whisper.js";

import type { BotContext } from "../types.js";

/**
 * Voice message handler.
 * Transcribes voice → calls converse → formats response.
 */
export async function handleVoice(ctx: BotContext): Promise<void> {
  const fileId = ctx.message?.voice?.file_id;
  if (!fileId) {
    return;
  }

  const transcription = await transcribeVoice(ctx, fileId);
  const sessionId = await ctx.services.sessionService.getSessionId(ctx);

  const converseResp = await ctx.services.mcpClient.callTool("converse", {
    sessionId,
    message: transcription,
    requestId: ctx.requestId,
  });

  const formatted = await formatResponse(converseResp, ctx.services, ctx.from?.language_code);

  await ctx.reply(formatted, { parse_mode: "Markdown" });
}
