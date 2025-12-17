import { mcpConverseParamsSchema } from "../../../shared/schemas.js";
import { createResponse } from "../../services/orchestrator/converse-response.js";
import { FlowGuardChecker } from "../../services/orchestrator/flow-guard-checker.service.js";
import { GraphManager } from "../../services/orchestrator/graph-manager.service.js";
import { classifyIntent } from "../../services/orchestrator/intent-classifier.js";
import { QueryExecutor } from "../../services/orchestrator/query-executor.service.js";

import { BaseTool } from "./base-tool.js";

import type { BaseToolDependencies } from "./base-tool.js";
import type { McpConverseParams, UserId } from "../../../shared/schemas.js";
import type { ConverseResponse } from "../../services/orchestrator/converse-response.js";

export class ConverseTool extends BaseTool<McpConverseParams, ConverseResponse> {
  private readonly graphManager: GraphManager;
  private readonly queryExecutor: QueryExecutor;
  private readonly flowGuardChecker: FlowGuardChecker;

  constructor(deps: BaseToolDependencies) {
    super(deps, mcpConverseParamsSchema);
    this.graphManager = new GraphManager(this.graphDeps);
    this.queryExecutor = new QueryExecutor(this.coreClient);
    this.flowGuardChecker = new FlowGuardChecker(this.coreClient);
  }

  protected async executeImpl(params: McpConverseParams, userId: UserId): Promise<ConverseResponse> {
    console.log("[CONVERSE TOOL] message:", params.message);
    console.log("[CONVERSE TOOL] userId:", userId);

    const intent = await classifyIntent(params.message);
    console.log("[CONVERSE TOOL] classified intent:", JSON.stringify(intent));

    // 1. Active graph — resume or cancel
    try {
      console.log("[CONVERSE TOOL] calling executeActiveGraph...");
      const activeResult = await this.graphManager.executeActiveGraph(intent, params.message, userId);
      console.log("[CONVERSE TOOL] activeResult:", activeResult ? "found" : "null");
      if (activeResult) return activeResult;
    } catch (error) {
      console.error("[CONVERSE TOOL] executeActiveGraph ERROR:", error);
      throw error;
    }

    // 2. Guards — help, cancel, onboarding, state checks
    try {
      console.log("[CONVERSE TOOL] calling flowGuardChecker...");
      const guardResult = await this.flowGuardChecker.check(intent, userId);
      console.log("[CONVERSE TOOL] guardResult:", guardResult ? "found" : "null");
      if (guardResult) return guardResult;
    } catch (error) {
      console.error("[CONVERSE TOOL] flowGuardChecker ERROR:", error);
      throw error;
    }

    // 3. New graph — cold_start, upsert_context, update_context, upsert_trail, search
    try {
      console.log("[CONVERSE TOOL] executing new graph...");
      const graphResult = await this.graphManager.executeNewGraph(intent, params.message, userId);
      console.log("[CONVERSE TOOL] graphResult phase:", graphResult?.result?.phase);
      if (graphResult) return graphResult;
    } catch (error) {
      console.error("[CONVERSE TOOL] executeNewGraph ERROR:", error);
      throw error;
    }

    // 4. Query — getStory, getGoal, deleteGoal, deleteContext, deleteTrail
    const queryResult = await this.queryExecutor.execute(intent, userId);
    if (queryResult) return queryResult;

    return createResponse("I didn't understand. Try 'help' for available commands.");
  }
}
