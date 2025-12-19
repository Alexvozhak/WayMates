import type { ConverseResponse, SystemMessage } from "../../shared/schemas.js";
import type { BotServices } from "../types.js";

/**
 * Type guard to check if result is a system message.
 * System messages are returned for guards, queries, and error responses.
 */
function isSystemMessage(result: ConverseResponse["result"]): result is SystemMessage {
  return result.phase === "system_message";
}

/**
 * Extract chartUrl from result if present (showing_results phase).
 */
function extractChartUrl(result: ConverseResponse["result"]): string | undefined {
  if ("chartUrl" in result && typeof result.chartUrl === "string") {
    return result.chartUrl;
  }
  return undefined;
}

/**
 * Router for formatting ConverseResponse.
 * Dispatches to the correct presenter based on activeGraph.
 *
 * @param converseResp - Response from converse.tool
 * @param languageCode - User language code (ru/en), defaults to "en" in BasePresenter
 * @param services - Bot services (presenters)
 * @returns Formatted markdown text
 *
 * @throws Error if activeGraph is unknown (should not happen if Facade is correct)
 */
export async function formatResponse(
  converseResp: ConverseResponse,
  services: BotServices,
  languageCode?: string,
): Promise<string> {
  const { result, activeGraph } = converseResp;

  // System messages (guards, queries, errors) — translate via LLM
  if (isSystemMessage(result)) {
    return await services.systemMessagePresenter.format(result, languageCode);
  }

  // Graph responses — format via LLM
  switch (activeGraph) {
    case "search": {
      let formatted = await services.searchGraphPresenter.format(result, languageCode);

      // Append chart link if present (guaranteed display, not relying on LLM)
      const chartUrl = extractChartUrl(result);
      if (chartUrl) {
        formatted += `\n\n📊 [Открыть график траекторий](${chartUrl})`;
      }

      return formatted;
    }

    case "cold_start":
    case "upsert_context":
    case "update_context":
    case "upsert_trail": {
      // CrudGraphPresenter — CRUD operations workflows
      return await services.crudGraphPresenter.format(result, languageCode);
    }

    default: {
      throw new Error(`Unknown graph: ${activeGraph}`);
    }
  }
}
