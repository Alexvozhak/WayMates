import { formatResponse } from "../presenters/format-response.js";
import { transcribeVoice } from "../services/whisper.js";

import type { BotContext } from "../types.js";

/**
 * Voice message handler.
 * Transcribes voice → calls converse → formats response.
 */
export async function handleVoice(ctx: BotContext): Promise<void> {
  const fileId = ctx.message?.voice?.file_id;
  if (!fileId || !ctx.userInfo) {
    return;
  }

  const transcription = await transcribeVoice(ctx, fileId);

  const languageCode = ctx.from?.language_code;

  const converseResp = await ctx.services.mcpClient.callTool("converse", {
    sessionId: ctx.userInfo.sessionId,
    message: transcription,
    requestId: ctx.requestId,
    locale: languageCode,
  });

  const formatted = formatResponse(converseResp, languageCode);

  await ctx.reply(formatted, { parse_mode: "MarkdownV2" });
}
