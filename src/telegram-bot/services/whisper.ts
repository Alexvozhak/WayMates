import { toFile } from "openai";

import { WhisperError } from "../errors.js";

import type { BotContext } from "../types.js";

export async function transcribeVoice(ctx: BotContext, fileId: string): Promise<string> {
  await ctx.replyWithChatAction("typing");
  const openai = ctx.services.openaiClient;
  const fileUrl = await getFileUrl(ctx, fileId);

  try {
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new WhisperError(`Failed to download voice: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const file = await toFile(buffer, "voice.ogg", { type: "audio/ogg" });

    const transcription = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
      language: "ru",
    });

    return transcription.text;
  } catch (error) {
    if (error instanceof WhisperError) throw error;
    const cause = error instanceof Error ? error : undefined;
    throw new WhisperError("Failed to transcribe voice message", cause);
  }
}

async function getFileUrl(ctx: BotContext, fileId: string): Promise<string> {
  const file = await ctx.api.getFile(fileId);
  if (!file.file_path) {
    throw new WhisperError("File path not found in Telegram response");
  }
  return `https://api.telegram.org/file/bot${ctx.services.botToken}/${file.file_path}`;
}
