export type { ConverseResponse } from "../../../shared/schemas.js";
export { converseResponseSchema } from "../../../shared/schemas.js";

import type { AnyGraphResponse, ConverseResponse } from "../../../shared/schemas.js";

export function createResponse(content: string): ConverseResponse {
  return { result: { phase: "system_message", content } };
}

export function createGraphResponse(result: AnyGraphResponse, activeGraph: string): ConverseResponse {
  return { result, activeGraph };
}
