import { mcpConverseParamsSchema } from "../../../shared/schemas.js";
import { createNlpResponse } from "../../services/orchestrator/converse-response.js";
import { FlowGuardChecker } from "../../services/orchestrator/flow-guard-checker.service.js";
import { GraphManager } from "../../services/orchestrator/graph-manager.service.js";
import { classifyIntent, NON_GRAPH_INTENT } from "../../services/orchestrator/intent-classifier.js";
import { QueryExecutor } from "../../services/orchestrator/query-executor.service.js";

import { BaseTool } from "./base-tool.js";

import type { BaseToolDependencies } from "./base-tool.js";
import type { Locale, McpConverseParams, UserId } from "../../../shared/schemas.js";
import type { ConverseResponse } from "../../services/orchestrator/converse-response.js";
import type { UserIntent } from "../../services/orchestrator/intent-classifier.js";

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
    const message = params.message;
    const locale: Locale = params.locale ?? "en";
    const intent = await classifyIntent(message);

    // 1. Active graph — resume or cancel
    const activeResult = await this.graphManager.executeActiveGraph(intent, message, userId, locale);
    if (activeResult) return activeResult;

    // 2. Guards — help, cancel, onboarding, state checks
    const guardResult = await this.flowGuardChecker.check(intent, userId, locale);
    if (guardResult) return guardResult;

    // 3. Project info — investor, tech, user documentation
    const docContent = await this.getProjectInfo(intent, message);
    if (docContent) return createNlpResponse(docContent);

    // 4. Query — getStory, getGoal, deleteGoal, deleteContext, deleteTrail
    const queryResult = await this.queryExecutor.execute(intent, userId, locale);
    if (queryResult) return queryResult;

    // 5. Graph — cold_start, upsert_context, update_context, upsert_trail, search
    const graphResult = await this.graphManager.executeNewGraph(intent, message, userId, locale);
    if (graphResult) return graphResult;

    return createNlpResponse("I didn't understand. Try 'help' for available commands.");
  }

  private async getProjectInfo(intent: UserIntent, question: string): Promise<string | null> {
    switch (intent) {
      case NON_GRAPH_INTENT.projectInvestor: {
        return this.documentaryService.answerInvestorQuestion(question);
      }
      case NON_GRAPH_INTENT.projectTech: {
        return this.documentaryService.answerTechQuestion(question);
      }
      case NON_GRAPH_INTENT.projectUser: {
        return this.documentaryService.answerUserQuestion(question);
      }
      default: {
        return null;
      }
    }
  }
}
