import { collectContexts } from "../../langchain/career-collector-agent.js";

import { BaseTool } from "./base-tool.js";

import type { UserId } from "../../../shared/schemas.js";
import type { ColdStartParams } from "../schemas.js";

export class ColdStartTool extends BaseTool<ColdStartParams, string> {
  protected async executeImpl(params: ColdStartParams, userId: UserId): Promise<string> {
    const threadId = `cold_start_${userId}`;

    console.log(
      `ColdStartTool: Starting/continuing session for userId=${userId}, threadId=${threadId}`,
    );

    const result = await collectContexts(params.message, threadId, {
      normalizer: this.normalizer,
      userId,
      coreClient: this.coreClient,
    });

    console.log(`ColdStartTool: Agent returned: ${result.message.slice(0, 100)}...`);

    // ✅ Simple pass-through - agent формирует human-friendly message
    return result.message;
  }
}
