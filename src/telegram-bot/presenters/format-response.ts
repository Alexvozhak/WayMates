import type { ConverseResponse } from "../../shared/schemas.js";
import type { BotServices } from "../types.js";

function extractChartUrl(result: ConverseResponse["result"]): string | undefined {
  if ("chartUrl" in result && typeof result.chartUrl === "string") {
    return result.chartUrl;
  }
  return undefined;
}

export async function formatResponse(
  converseResp: ConverseResponse,
  services: BotServices,
  languageCode?: string,
): Promise<string> {
  const { result, message } = converseResp;

  // Skip translation for English (NLP already in English)
  const needsTranslation = languageCode && languageCode !== "en";
  let formatted = needsTranslation ? await services.systemMessagePresenter.format(message, languageCode) : message;

  // Append chart link if present (guaranteed display)
  const chartUrl = extractChartUrl(result);
  if (chartUrl) {
    formatted += `\n\n📊 [Открыть график траекторий](${chartUrl})`;
  }

  return formatted;
}
