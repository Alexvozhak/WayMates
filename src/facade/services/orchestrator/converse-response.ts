import { z } from "zod";

import { anyGraphResponseSchema } from "../../../shared/schemas.js";

export const converseResponseSchema = z.object({
  result: anyGraphResponseSchema,
  activeGraph: z.string().optional(),
});

export type ConverseResponse = z.infer<typeof converseResponseSchema>;

export function createResponse(content: string): ConverseResponse {
  return { result: { phase: "system_message", content } };
}

export function createGraphResponse(
  result: z.infer<typeof anyGraphResponseSchema>,
  activeGraph: string,
): ConverseResponse {
  return { result, activeGraph };
}
