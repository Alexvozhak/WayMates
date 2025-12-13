import { z } from "zod";

export const converseResponseSchema = z.object({
  response: z.string(),
  activeGraph: z.string().optional(),
  phase: z.string().optional(),
});

export type ConverseResponse = z.infer<typeof converseResponseSchema>;

export function createResponse(response: string, extras?: Partial<ConverseResponse>): ConverseResponse {
  return { response, ...extras };
}

export function createGraphResponse(response: string, activeGraph: string, phase: string): ConverseResponse {
  return { response, activeGraph, phase };
}
