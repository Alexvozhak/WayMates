import telegramifyMarkdown from "telegramify-markdown";

import type { ConverseResponse } from "../../shared/schemas.js";

// Only en/ru hardcoded, other locales fallback to en
const CHART_LINK_LABEL: Record<"en" | "ru", string> = {
  en: "Open trajectory chart",
  ru: "Открыть график траекторий",
};

function getChartLabel(languageCode: string | undefined): string {
  return languageCode === "ru" ? CHART_LINK_LABEL.ru : CHART_LINK_LABEL.en;
}

function extractChartUrl(result: ConverseResponse["result"]): string | undefined {
  if ("chartUrl" in result && typeof result.chartUrl === "string") {
    return result.chartUrl;
  }
  return undefined;
}

/**
 * Format converse response for Telegram.
 * No LLM translation — Facade already responds in user's language.
 */
export function formatResponse(converseResp: ConverseResponse, languageCode?: string): string {
  const { result, message } = converseResp;

  let formatted = message;

  // Append chart link if present
  const chartUrl = extractChartUrl(result);
  if (chartUrl) {
    formatted += `\n\n📊 [${getChartLabel(languageCode)}](${chartUrl})`;
  }

  // Convert standard Markdown to Telegram MarkdownV2
  return telegramifyMarkdown(formatted, "escape");
}
