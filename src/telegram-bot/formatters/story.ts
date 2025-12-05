import { extractTextContent, isRecord, parseJsonContent } from "../services/mcp-utils.js";

import type { McpToolResult } from "../services/mcp-client.js";

type ColdStartData = { phase?: string; message?: string; extractedData?: unknown };

export function formatColdStartResult(result: McpToolResult): string {
  const text = extractTextContent(result);
  if (!text) {
    return "❌ Не удалось обработать ответ";
  }

  const data = parseJsonContent<ColdStartData>(result);
  return data ? formatColdStartPhase(data, text) : text;
}

function formatColdStartPhase(data: ColdStartData, fallback: string): string {
  if (data.phase === "COLLECTING" && data.message) {
    return `${data.message}\n\n💡 Продолжайте рассказывать о своём опыте.`;
  }

  if (data.phase === "CONFIRMING" && data.message && data.extractedData) {
    return `${data.message}\n\n${formatExtractedData(data.extractedData)}\n\n✅ Всё верно?`;
  }

  return data.message ?? fallback;
}

function formatExtractedData(data: unknown): string {
  if (!isRecord(data) || !Array.isArray(data.contexts)) {
    return "";
  }

  return data.contexts.map((ctx, i) => formatSingleContext(ctx, i + 1)).join("\n");
}

function formatSingleContext(context: unknown, index: number): string {
  if (!isRecord(context)) {
    return "";
  }

  const skills = Array.isArray(context.skills) ? context.skills.join(", ") : "—";

  return (
    `\n**Контекст ${index}:**\n` +
    `• Позиция: ${context.position}\n` +
    `• Компания: ${context.organization}\n` +
    `• Период: ${context.startDate} — ${context.endDate}\n` +
    `• Локация: ${context.location}\n` +
    `• Навыки: ${skills}`
  );
}
