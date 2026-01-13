export type { ConverseResponse } from "../../../../private/schemas.js";
export { converseResponseSchema } from "../../../../private/schemas.js";

import type { ConverseResponse } from "../../../../private/schemas.js";

export function createNlpResponse(message: string): ConverseResponse {
  return {
    result: { phase: "system_message" },
    message,
    activeGraph: null,
  };
}
