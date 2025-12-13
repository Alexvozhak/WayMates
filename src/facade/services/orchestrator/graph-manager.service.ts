import { ColdStartGraph } from "../../langGraph/cold-start-v2/cold-start-graph.js";
import { UpdateContextGraph } from "../../langGraph/update-context/update-context-graph.js";
import { UpsertContextGraph } from "../../langGraph/upsert-context/upsert-context-graph.js";
import { UpsertTrailGraph } from "../../langGraph/upsert-trail/upsert-trail-graph.js";

import { loadCurrentContext } from "./context-utils.js";
import { createGraphResponse } from "./converse-response.js";

import type { ConverseResponse } from "./converse-response.js";
import type { UserIntent } from "./intent-classifier.js";
import type {
  ColdStartResponse,
  UpdateContextResponse,
  UpsertContextResponse,
  UpsertTrailResponse,
  UserId,
} from "../../../shared/schemas.js";
import type { CoreClient } from "../../core-client.js";
import type { CheckpointService } from "../checkpoint.service.js";
import type { Normalizer } from "../normalizer.js";
import type { UserService } from "../user.service.js";

const GRAPH_TYPES = ["cold_start", "upsert_context", "upsert_trail", "update_context", "search"] as const;
type GraphType = (typeof GRAPH_TYPES)[number];

type GraphInput = { type: GraphType; message: string; userId: UserId };

type AnyGraphResponse =
  | ColdStartResponse
  | UpsertContextResponse
  | UpdateContextResponse
  | UpsertTrailResponse
  | { phase: "not_implemented"; message: string };

const INTENT_TO_GRAPH: Partial<Record<UserIntent, GraphType>> = {
  startStory: "cold_start",
  startContext: "upsert_context",
  startAdhoc: "search",
  addContext: "upsert_context",
  updateContext: "update_context",
  addTrail: "upsert_trail",
  search: "search",
  setGoal: "search",
};

const TERMINAL_PHASES = new Set(["saved", "cancelled", "failed"]);

export class GraphManager {
  constructor(
    private readonly checkpointService: CheckpointService,
    private readonly coreClient: CoreClient,
    private readonly normalizer: Normalizer,
    private readonly userService: UserService,
  ) {}

  async executeActiveGraph(intent: UserIntent, message: string, userId: UserId): Promise<ConverseResponse | null> {
    const activeGraph = await this.findActiveGraph(userId);
    if (!activeGraph) {
      return null;
    }

    if (intent === "cancel") {
      return this.cancel(activeGraph.type, userId);
    }
    return this.resume(activeGraph.type, message, userId);
  }

  async executeNewGraph(intent: UserIntent, message: string, userId: UserId): Promise<ConverseResponse | null> {
    const graphType = INTENT_TO_GRAPH[intent];
    if (!graphType) {
      return null;
    }

    return this.run({ type: graphType, message, userId });
  }

  private async findActiveGraph(userId: UserId): Promise<{ type: GraphType; threadId: string } | null> {
    for (const type of GRAPH_TYPES) {
      const threadId = `${type}_${userId}`;
      const hasPending = await this.checkpointService.hasPendingInterrupt(threadId);
      if (hasPending) {
        return { type, threadId };
      }
    }
    return null;
  }

  private async run(input: GraphInput): Promise<ConverseResponse> {
    const threadId = `${input.type}_${input.userId}`;
    const checkpointer = this.checkpointService.getCheckpointer();

    const result = await this.executeGraph(input, threadId, checkpointer);

    if (TERMINAL_PHASES.has(result.phase)) {
      await this.checkpointService.delete(threadId);
    }

    return createGraphResponse(result.message, input.type, result.phase);
  }

  private async cancel(graphType: GraphType, userId: UserId): Promise<ConverseResponse> {
    const threadId = `${graphType}_${userId}`;
    await this.checkpointService.delete(threadId);
    return createGraphResponse("Operation cancelled.", graphType, "cancelled");
  }

  private async resume(graphType: GraphType, message: string, userId: UserId): Promise<ConverseResponse> {
    return this.run({ type: graphType, message, userId });
  }

  private async executeGraph(
    input: GraphInput,
    threadId: string,
    checkpointer: ReturnType<CheckpointService["getCheckpointer"]>,
  ): Promise<AnyGraphResponse> {
    switch (input.type) {
      case "cold_start": {
        const graph = new ColdStartGraph(input.userId, checkpointer);
        return graph.run(input.message, threadId, this.coreClient, this.normalizer, this.userService);
      }

      case "upsert_context": {
        const graph = new UpsertContextGraph(input.userId, checkpointer);
        return graph.run(input.message, threadId, this.coreClient, this.normalizer);
      }

      case "update_context": {
        const currentContext = await loadCurrentContext(this.coreClient, input.userId);
        if (!currentContext) {
          throw new Error("No current context found for update_context");
        }
        const graph = new UpdateContextGraph(input.userId, currentContext, checkpointer);
        return graph.run(input.message, threadId, this.coreClient, this.normalizer);
      }

      case "upsert_trail": {
        const graph = new UpsertTrailGraph(input.userId, null, checkpointer);
        return graph.run(input.message, threadId, this.coreClient, this.normalizer);
      }

      case "search": {
        return { phase: "not_implemented", message: "SearchGraph is not yet implemented" };
      }
    }
  }
}
