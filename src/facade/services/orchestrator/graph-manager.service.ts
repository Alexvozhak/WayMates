import { ColdStartGraph } from "../../langGraph/cold-start-v2/cold-start-graph.js";
import { SearchGraph } from "../../langGraph/search-graph/search-graph.js";
import { PHASE } from "../../langGraph/shared/phases.js";
import { getModel } from "../../langGraph/shared-tools/models.js";
import { UpdateContextGraph } from "../../langGraph/update-context/update-context-graph.js";
import { UpsertContextGraph } from "../../langGraph/upsert-context/upsert-context-graph.js";
import { UpsertTrailGraph } from "../../langGraph/upsert-trail/upsert-trail-graph.js";
import { NlpFormatter } from "../nlp-formatter/index.js";

import { loadCurrentContext } from "./context-utils.js";
import { type GraphIntent, type UserIntent, graphIntentSchema } from "./intent-classifier.js";

import type { AnyGraphResponse, ConverseResponse, Locale, UserId } from "../../../../private/schemas.js";
import type { GraphDeps } from "../../langGraph/shared/types.js";

const GRAPH_TYPES = ["cold_start", "upsert_context", "upsert_trail", "update_context", "search"] as const;
type GraphType = (typeof GRAPH_TYPES)[number];

type GraphInput = { type: GraphType; message: string; userId: UserId; intent: GraphIntent | null; locale: Locale };

const INTENT_TO_GRAPH: Record<GraphIntent, GraphType> = {
  startStory: "cold_start",
  startAdhoc: "search",
  // MVP: Disabled CRUD operations
  // addContext: "upsert_context",
  // updateContext: "update_context",
  // addTrail: "upsert_trail",
  search: "search",
  setGoal: "search",
};

const TERMINAL_PHASES = new Set(["saved", "cancelled", "failed"]);

export class GraphManager {
  private readonly nlpFormatter: NlpFormatter;

  constructor(private readonly deps: GraphDeps) {
    this.nlpFormatter = new NlpFormatter(getModel("agent"));
  }

  async cancelAllActiveGraphs(userId: UserId): Promise<void> {
    for (const type of GRAPH_TYPES) {
      const threadId = `${type}_${userId}`;
      await this.deps.checkpointService.delete(threadId);
    }
  }

  async executeActiveGraph(
    intent: UserIntent,
    message: string,
    userId: UserId,
    locale: Locale,
  ): Promise<ConverseResponse | null> {
    const activeGraphType = await this.findActiveGraph(userId);
    if (!activeGraphType) return null;

    if (intent === "cancel") {
      return this.cancel(activeGraphType, userId, locale);
    }
    return this.run({ type: activeGraphType, message, userId, intent: null, locale });
  }

  async executeNewGraph(
    intent: UserIntent,
    message: string,
    userId: UserId,
    locale: Locale,
  ): Promise<ConverseResponse | null> {
    const parsed = graphIntentSchema.safeParse(intent);
    if (!parsed.success) return null;

    const graphType = INTENT_TO_GRAPH[parsed.data];
    return this.run({ type: graphType, message, userId, intent: parsed.data, locale });
  }

  private async cancel(graphType: GraphType, userId: UserId, locale: Locale): Promise<ConverseResponse> {
    const threadId = `${graphType}_${userId}`;
    await this.deps.checkpointService.delete(threadId);

    const result = { phase: PHASE.cancelled };
    const message = await this.nlpFormatter.format(result, graphType, locale);
    return { result, message, activeGraph: graphType };
  }

  private async run(input: GraphInput): Promise<ConverseResponse> {
    const threadId = `${input.type}_${input.userId}`;
    const result = await this.executeGraph(input, threadId);

    if (TERMINAL_PHASES.has(result.phase)) {
      await this.deps.checkpointService.delete(threadId);
    }

    const message = await this.nlpFormatter.format(result, input.type, input.locale);
    return { result, message, activeGraph: input.type };
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
        return graph.run(input.message, threadId, input.userId, null, input.locale);
      }

      case "upsert_context": {
        const graph = new UpsertContextGraph(this.deps);
        return graph.run(input.message, threadId, input.userId, input.locale);
      }

      case "update_context": {
        const currentContext = await loadCurrentContext(this.deps.coreClient, input.userId);
        if (!currentContext) {
          throw new Error("No current context found for update_context");
        }
        const graph = new UpdateContextGraph(this.deps);
        return graph.run(input.message, threadId, input.userId, currentContext, input.locale);
      }

      case "upsert_trail": {
        const graph = new UpsertTrailGraph(this.deps);
        return graph.run(input.message, threadId, input.userId, null, input.locale);
      }

      case "search": {
        const graph = new SearchGraph(this.deps);
        return graph.run(input.message, threadId, input.userId, input.intent, input.locale);
      }
    }
  }
}
