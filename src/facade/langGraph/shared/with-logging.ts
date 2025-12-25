import { AgentInvariantError } from "../../errors.js";

import { hasConfigDeps } from "./types.js";

import type { GraphDeps } from "./types.js";
import type { UserId } from "../../../shared/schemas.js";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";

type StateWithUserId = { userId: UserId };

type NodeFn<S extends StateWithUserId> = (
  state: S,
  config: LangGraphRunnableConfig,
  deps: GraphDeps,
) => Partial<S> | Promise<Partial<S>>;

// eslint-disable-next-line complexity
function summarizeState(state: Record<string, unknown>): Record<string, unknown> {
  const summary: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(state)) {
    if (key === "messages") {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      summary[key] = `[${(value as unknown[])?.length ?? 0} messages]`;
    } else if (Array.isArray(value)) {
      summary[key] = `[${value.length} items]`;
    } else if (typeof value === "object" && value !== null) {
      summary[key] = "{...}";
    } else if (typeof value === "string" && value.length > 100) {
      summary[key] = value.slice(0, 100) + "...";
    } else {
      summary[key] = value;
    }
  }
  return summary;
}

export function createWithLogging<NodeEnum extends Record<string, string>>() {
  return function withLogging<S extends StateWithUserId>(
    nodeName: NodeEnum[keyof NodeEnum],
    fn: NodeFn<S>,
  ): (state: S, config: LangGraphRunnableConfig) => Promise<Partial<S>> {
    return async (state: S, config: LangGraphRunnableConfig) => {
      if (!hasConfigDeps(config)) {
        throw new AgentInvariantError(nodeName, "Config deps required");
      }
      const deps = config.configurable;
      const start = Date.now();
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const inputSummary = summarizeState(state as Record<string, unknown>);
      deps.logger.info({ node: nodeName, userId: state.userId, input: inputSummary }, `Executing ${nodeName}`);

      const result = await fn(state, config, deps);

      const durationMs = Date.now() - start;
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const outputSummary = summarizeState(result as Record<string, unknown>);
      deps.logger.info({ node: nodeName, durationMs, output: outputSummary }, `Completed ${nodeName}`);
      return result;
    };
  };
}
