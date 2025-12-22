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

export function createWithLogging<NodeEnum extends Record<string, string>>() {
  return function withLogging<S extends StateWithUserId>(
    nodeName: NodeEnum[keyof NodeEnum],
    fn: NodeFn<S>,
  ): (state: S, config: LangGraphRunnableConfig) => Partial<S> | Promise<Partial<S>> {
    return (state: S, config: LangGraphRunnableConfig) => {
      if (!hasConfigDeps(config)) {
        throw new AgentInvariantError(nodeName, "Config deps required");
      }
      const deps = config.configurable;
      deps.logger.info({ node: nodeName, userId: state.userId }, `Executing ${nodeName}`);
      return fn(state, config, deps);
    };
  };
}
