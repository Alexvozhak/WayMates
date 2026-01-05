import { formatResponse } from "../presenters/format-response.js";

import type { BotContext } from "../types.js";

/**
 * Document handler for CV/resume uploads.
 * Downloads PDF → calls parse_cv_to_text → sends result to converse.
 */
export async function handleDocument(ctx: BotContext): Promise<void> {
  const document = ctx.message?.document;
  if (!document) {
    return;
  }

  // Only accept PDF files
  if (document.mime_type !== "application/pdf") {
    await ctx.reply(ctx.t("doc-pdf-only"));
    return;
  }

  await ctx.reply(ctx.t("doc-processing"));

  // Download file from Telegram
  const file = await ctx.api.getFile(document.file_id);
  const fileUrl = `https://api.telegram.org/file/bot${ctx.api.token}/${file.file_path}`;

  const response = await fetch(fileUrl);
  const arrayBuffer = await response.arrayBuffer();
  const fileBuffer = Buffer.from(arrayBuffer).toString("base64");

  const sessionId = await ctx.services.sessionService.getSessionId(ctx);

  // Parse CV to markdown via LLM
  const parseResult = await ctx.services.mcpClient.callTool("parse_cv_to_text", {
    sessionId,
    fileBuffer,
    requestId: ctx.requestId,
  });

  const parsedText = parseResult.text;

  const locale = ctx.from?.language_code === "ru" ? "ru" : "en";

  // Send parsed CV text to converse for career story extraction
  const converseResp = await ctx.services.mcpClient.callTool("converse", {
    sessionId,
    message: `${ctx.t("doc-cv-prefix")}\n\n${parsedText}`,
    requestId: ctx.requestId,
    locale,
  });

  const formatted = formatResponse(converseResp, ctx.from?.language_code);

  await ctx.reply(formatted, { parse_mode: "MarkdownV2" });
}
