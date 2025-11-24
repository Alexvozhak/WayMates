import { userContextSchema } from "../../../shared/schemas.js";
import { collectContexts } from "../../langchain/career-collector-agent.js";

import { BaseTool } from "./base-tool.js";

import type { UserId } from "../../../shared/schemas.js";
import type { CollectorResult, CollectorStatus } from "../../langchain/career-collector-agent.js";
import type { ColdStartParams } from "../schemas.js";

type ColdStartInProgressResult = {
  status: Exclude<CollectorStatus, "complete">;
  message: string;
  nextAction: "provide_data" | "answer_questions" | "confirm";
  contexts?: never;
  trails?: never;
};

type ColdStartCompleteResult = {
  status: "complete";
  message: string;
  contextsUpserted: number;
  trailsUpserted: number;
};

type ColdStartResult = ColdStartInProgressResult | ColdStartCompleteResult;

export class ColdStartTool extends BaseTool<ColdStartParams, ColdStartResult> {
  protected async executeImpl(params: ColdStartParams, userId: UserId): Promise<ColdStartResult> {
    const threadId = `cold_start_${userId}`;

    console.log(`ColdStartTool: Starting collection for userId=${userId}, threadId=${threadId}`);

    // Call CareerCollectorAgent
    const result: CollectorResult = await collectContexts(params.message, threadId, {
      normalizer: this.normalizer,
      userId,
    });

    console.log(`ColdStartTool: Agent returned status=${result.status}`);

    // Handle statuses
    switch (result.status) {
      case "collecting": {
        return {
          status: "collecting",
          message: result.message,
          nextAction: "provide_data",
        };
      }

      case "awaiting_clarification": {
        return {
          status: "awaiting_clarification",
          message: result.message,
          nextAction: "answer_questions",
        };
      }

      case "awaiting_confirmation": {
        return {
          status: "awaiting_confirmation",
          message: result.message,
          nextAction: "confirm",
        };
      }

      case "complete": {
        return this.handleCompleteStatus(result, userId);
      }

      default: {
        // TypeScript exhaustiveness check
        const exhaustiveCheck: never = result.status;
        throw new Error(`Unknown status: ${String(exhaustiveCheck)}`);
      }
    }
  }

  private async handleCompleteStatus(
    result: CollectorResult,
    userId: UserId,
  ): Promise<ColdStartCompleteResult> {
    if (!result.contexts || result.contexts.length === 0) {
      throw new Error("Agent returned 'complete' status but no contexts provided");
    }

    console.log(`ColdStartTool: Saving ${result.contexts.length} contexts to Neo4j`);

    // Validate contexts (FacadeNormalizer already created unverified terms)
    const validatedContexts = result.contexts.map((ctx) => {
      return userContextSchema.parse(ctx);
    });

    console.log(`ColdStartTool: Saving story to Neo4j via Core API`);

    // Save to Neo4j via Core API
    const upsertResult = await this.coreClient.client.story.upsertStory.mutate({
      userId,
      contexts: validatedContexts,
      trails: result.trails || [],
    });

    const contextsCount = upsertResult.contexts.contextIds.length;
    const trailsCount = upsertResult.trails.trailIds.length;

    console.log(
      `ColdStartTool: Story saved successfully (${contextsCount} contexts, ${trailsCount} trails)`,
    );

    return {
      status: "complete",
      message: `Successfully imported ${contextsCount} positions, ${trailsCount} transitions`,
      contextsUpserted: contextsCount,
      trailsUpserted: trailsCount,
    };
  }
}
