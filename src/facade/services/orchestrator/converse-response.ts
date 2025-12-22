export type { ConverseResponse } from "../../../shared/schemas.js";
export { converseResponseSchema } from "../../../shared/schemas.js";

import type { ConverseResponse } from "../../../shared/schemas.js";

export function createNlpResponse(message: string): ConverseResponse {
  return {
    result: { phase: "system_message" },
    message,
    activeGraph: null,
  };
}
