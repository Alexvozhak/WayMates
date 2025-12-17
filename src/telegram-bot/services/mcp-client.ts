import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { CallToolResultSchema, TextContentSchema } from "@modelcontextprotocol/sdk/types.js";

import packageJson from "../../../package.json" with { type: "json" };
import { McpClientError } from "../errors.js";

import { TOOL_REGISTRY } from "./tool-registry.js";

import type { FacadeToolName, ToolResponse } from "./tool-registry.js";

export class McpClient {
  static async create(baseUrl: string): Promise<McpClient> {
    const client = new Client({
      name: packageJson.name,
      version: packageJson.version,
    });

    const transport = new StreamableHTTPClientTransport(new URL(baseUrl));

    // @ts-expect-error TS2379: exactOptionalPropertyTypes incompatibility with MCP SDK
    await client.connect(transport);

    return new McpClient(client);
  }

  private constructor(private readonly client: Client) {}

  async callTool<T extends FacadeToolName>(toolName: T, params: Record<string, unknown>): Promise<ToolResponse<T>> {
    const tool = TOOL_REGISTRY[toolName];

    try {
      const validatedParams = tool.paramsSchema.parse(params);

      const rawResult = await this.client.callTool(
        {
          name: toolName,
          arguments: validatedParams,
        },
        CallToolResultSchema,
      );

      const result = CallToolResultSchema.parse(rawResult);
      const content = TextContentSchema.parse(result.content[0]);

      // DEBUG: Log raw response before JSON parse (helps debug FastMCP errors)
      if (!content.text.trim().startsWith("{")) {
        console.error(`[MCP Client] Non-JSON response from tool '${toolName}':`, content.text.slice(0, 500));
      }

      const data = JSON.parse(content.text);

      // DEBUG: Log parsed data before validation
      console.log(`[MCP Client DEBUG] Parsed data from '${toolName}':`, JSON.stringify(data, null, 2).slice(0, 1000));

      const validatedResponse = tool.responseSchema.parse(data);
      return validatedResponse;
    } catch (error) {
      if (error instanceof McpClientError) {
        throw error;
      }

      const err = error instanceof Error ? error : new Error(String(error));
      throw new McpClientError(err.message, err);
    }
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}
