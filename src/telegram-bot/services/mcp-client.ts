import axios, { type AxiosInstance } from "axios";
import { z } from "zod";

import { resultErrorSchema } from "../../shared/schemas.js";
import { McpClientError } from "../errors.js";

let requestId = 0;

const mcpResponseSchema = z.object({
  result: z
    .object({
      content: z.array(
        z.object({
          type: z.string(),
          text: z.string().optional(),
        }),
      ),
      isError: z.boolean().optional(),
    })
    .optional(),
  error: z
    .object({
      code: z.number(),
      message: z.string(),
    })
    .optional(),
});

export type McpToolResult = {
  content: {
    type: string;
    text?: string | undefined;
  }[];
  isError?: boolean | undefined;
};

export class McpClient {
  private axiosInstance: AxiosInstance;

  constructor(baseUrl: string, timeoutMs: number) {
    this.axiosInstance = axios.create({
      baseURL: baseUrl,
      timeout: timeoutMs,
    });
  }

  async callTool<TParams, TResponse>(
    toolName: string,
    params: TParams,
    paramsSchema: z.ZodType<TParams>,
    responseSchema: z.ZodType<TResponse>,
  ): Promise<TResponse> {
    const validatedParams = paramsSchema.parse(params);
    const result = await this.sendWithRetry(toolName, validatedParams);
    const parsedContent = this.parseJsonContent(result);
    return responseSchema.parse(parsedContent);
  }

  private async sendWithRetry(toolName: string, params: unknown): Promise<McpToolResult> {
    const maxRetries = 3;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await this.sendRequest(toolName, params);
      } catch (error) {
        lastError = this.handleRetryError(error);

        const delay = Math.pow(2, attempt) * 1000;
        await this.sleep(delay);
      }
    }

    throw new McpClientError(`Failed after ${maxRetries} retries`, lastError);
  }

  private handleRetryError(error: unknown): Error {
    const err = error instanceof Error ? error : new Error(String(error));

    if (this.isClientError(err)) {
      throw err;
    }

    return err;
  }

  private async sendRequest(toolName: string, params: unknown): Promise<McpToolResult> {
    const response = await this.axiosInstance.post("", {
      jsonrpc: "2.0",
      id: ++requestId,
      method: "tools/call",
      params: {
        name: toolName,
        arguments: params,
      },
    });

    const data = mcpResponseSchema.parse(response.data);

    if (data.error) {
      throw new McpClientError(`MCP error: ${data.error.message}`);
    }

    if (!data.result) {
      throw new McpClientError("No result in MCP response");
    }

    return data.result;
  }

  private parseJsonContent(result: McpToolResult): unknown {
    if (result.content.length === 0) {
      throw new McpClientError("Tool result has no content");
    }

    const firstContent = result.content[0];
    if (!firstContent || firstContent.type !== "text") {
      throw new McpClientError(`Unexpected content type: ${firstContent?.type}`);
    }

    if (!firstContent.text) {
      throw new McpClientError("Content has no text");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(firstContent.text);
    } catch {
      throw new McpClientError("Failed to parse tool result as JSON");
    }

    // Check Result<T, ErrorResponse> discriminator using Zod schema
    const resultCheck = resultErrorSchema.safeParse(parsed);
    if (resultCheck.success) {
      const { error } = resultCheck.data;
      throw new McpClientError(error.message, error.code, error.details);
    }

    return parsed;
  }

  private isClientError(error: Error): boolean {
    return error.message.includes("HTTP error 4");
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
