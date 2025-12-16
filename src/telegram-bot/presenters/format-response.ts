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

  // System messages (guards, queries, errors) — return as-is
  if (isSystemMessage(result)) {
    return result.content;
  }

  // Graph responses — format via LLM
  switch (activeGraph) {
    case "search": {
      // BasePresenter.format() accepts unknown, no cast needed
      return await services.searchGraphPresenter.format(result, languageCode);
    }

    case "cold_start":
    case "upsert_context":
    case "update_context":
    case "upsert_trail": {
      // LangGraphPresenter — universal for 4 graphs
      return await services.langGraphPresenter.format(result, languageCode);
    }

    default: {
      throw new Error(`Unknown graph: ${activeGraph}`);
    }
  }
}
