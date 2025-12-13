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
    this.graphManager = new GraphManager(this.checkpointService, this.coreClient, this.normalizer, this.userService);
    this.queryExecutor = new QueryExecutor(this.coreClient);
    this.flowGuardChecker = new FlowGuardChecker(this.coreClient);
  }

  protected async executeImpl(params: McpConverseParams, userId: UserId): Promise<ConverseResponse> {
    const { intent } = await classifyIntent(params.message);

    // 1. Active graph — cancel or resume
    const activeResult = await this.graphManager.executeActiveGraph(intent, params.message, userId);
    if (activeResult) {
      return activeResult;
    }

    // 2. Guards — help, onboarding, state checks
    const earlyResponse = await this.flowGuardChecker.check(intent, userId);
    if (earlyResponse) {
      return earlyResponse;
    }

    // 3. Query — getStory, getGoal, deleteGoal, deleteContext
    const queryResult = await this.queryExecutor.execute(intent, userId);
    if (queryResult) {
      return queryResult;
    }

    // 4. Graph — cold_start, upsert_context, update_context, upsert_trail, search
    const graphResult = await this.graphManager.executeNewGraph(intent, params.message, userId);
    if (graphResult) {
      return graphResult;
    }

    return createResponse("I didn't understand. Try 'help' for available commands.");
  }
}
