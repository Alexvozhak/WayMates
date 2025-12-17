import { ColdStartGraph } from "../../langGraph/cold-start-v2/cold-start-graph.js";
import { SearchGraph } from "../../langGraph/search-graph/search-graph.js";
import { UpdateContextGraph } from "../../langGraph/update-context/update-context-graph.js";
import { UpsertContextGraph } from "../../langGraph/upsert-context/upsert-context-graph.js";
import { UpsertTrailGraph } from "../../langGraph/upsert-trail/upsert-trail-graph.js";

import { loadCurrentContext } from "./context-utils.js";
import { createGraphResponse } from "./converse-response.js";
import { type GraphIntent, type UserIntent, graphIntentSchema } from "./intent-classifier.js";

import type { ConverseResponse } from "./converse-response.js";
import type { AnyGraphResponse, UserId } from "../../../shared/schemas.js";
import type { GraphDeps } from "../../langGraph/shared/types.js";

const GRAPH_TYPES = ["cold_start", "upsert_context", "upsert_trail", "update_context", "search"] as const;
type GraphType = (typeof GRAPH_TYPES)[number];

type GraphInput = { type: GraphType; message: string; userId: UserId; intent: GraphIntent | null };

const INTENT_TO_GRAPH: Record<GraphIntent, GraphType> = {
  startStory: "cold_start",
  startAdhoc: "search",
  addContext: "upsert_context",
  updateContext: "update_context",
  addTrail: "upsert_trail",
  search: "search",
  setGoal: "search",
};

const TERMINAL_PHASES = new Set(["saved", "cancelled", "failed"]);

export class GraphManager {
  constructor(private readonly deps: GraphDeps) {}

  async executeActiveGraph(intent: UserIntent, message: string, userId: UserId): Promise<ConverseResponse | null> {
    const activeGraphType = await this.findActiveGraph(userId);
    if (!activeGraphType) return null;

    if (intent === "cancel") {
      return this.cancel(activeGraphType, userId);
    }
    return this.run({ type: activeGraphType, message, userId, intent: null });
  }

  async executeNewGraph(intent: UserIntent, message: string, userId: UserId): Promise<ConverseResponse | null> {
    const parsed = graphIntentSchema.safeParse(intent);
    if (!parsed.success) return null;

    const graphType = INTENT_TO_GRAPH[parsed.data];
    return this.run({ type: graphType, message, userId, intent: parsed.data });
  }

  private async cancel(graphType: GraphType, userId: UserId): Promise<ConverseResponse> {
    const threadId = `${graphType}_${userId}`;
    await this.deps.checkpointService.delete(threadId);
    return createGraphResponse({ phase: "cancelled" }, graphType);
  }

  private async run(input: GraphInput): Promise<ConverseResponse> {
    const threadId = `${input.type}_${input.userId}`;
    const result = await this.executeGraph(input, threadId);

    // DEBUG: Check result before wrapping
    console.log("[GRAPH MANAGER] graph type:", input.type);
    console.log("[GRAPH MANAGER] result phase:", result.phase);
    console.log("[GRAPH MANAGER] result keys:", Object.keys(result));

    if (TERMINAL_PHASES.has(result.phase)) {
      await this.deps.checkpointService.delete(threadId);
    }

    return createGraphResponse(result, input.type);
  }

  private async findActiveGraph(userId: UserId): Promise<GraphType | null> {
    for (const type of GRAPH_TYPES) {
      const threadId = `${type}_${userId}`;
      const hasPending = await this.deps.checkpointService.hasPendingInterrupt(threadId);
      if (hasPending) {
        return type;
      }
    }
    return null;
  }

  private async executeGraph(input: GraphInput, threadId: string): Promise<AnyGraphResponse> {
    switch (input.type) {
      case "cold_start": {
        const graph = new ColdStartGraph(this.deps);
        return graph.run(input.message, threadId, input.userId);
      }

      case "upsert_context": {
        const graph = new UpsertContextGraph(this.deps);
        return graph.run(input.message, threadId, input.userId);
      }

      case "update_context": {
        const currentContext = await loadCurrentContext(this.deps.coreClient, input.userId);
        if (!currentContext) {
          throw new Error("No current context found for update_context");
        }
        const graph = new UpdateContextGraph(this.deps);
        return graph.run(input.message, threadId, input.userId, currentContext);
      }

      case "upsert_trail": {
        const graph = new UpsertTrailGraph(this.deps);
        return graph.run(input.message, threadId, input.userId, null);
      }

      case "search": {
        const graph = new SearchGraph(this.deps);
        const searchResult = await graph.run(input.message, threadId, input.userId, input.intent);
        console.log("[EXECUTE GRAPH] search result phase:", searchResult.phase);
        console.log("[EXECUTE GRAPH] search result keys:", Object.keys(searchResult));
        console.log("[EXECUTE GRAPH] search result JSON:", JSON.stringify(searchResult, null, 2));
        return searchResult;
      }
    }
  }
}
