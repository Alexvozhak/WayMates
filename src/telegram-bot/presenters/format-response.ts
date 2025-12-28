import type { ConverseResponse, Locale } from "../../shared/schemas.js";

const CHART_LINK_LABEL: Record<Locale, string> = {
  en: "Open trajectory chart",
  ru: "Открыть график траекторий",
};

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
  const locale: Locale = languageCode === "ru" ? "ru" : "en";

  let formatted = message;

  // Append chart link if present
  const chartUrl = extractChartUrl(result);
  if (chartUrl) {
    formatted += `\n\n📊 [${CHART_LINK_LABEL[locale]}](${chartUrl})`;
  }

  return formatted;
}
