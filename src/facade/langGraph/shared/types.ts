import type { CoreClient } from "../../core-client.js";
import type { CheckpointService } from "../../services/checkpoint.service.js";
import type { DictionariesCache } from "../../services/dictionaries-cache.js";
import type { Normalizer } from "../../services/normalizer.js";
import type { UserService } from "../../services/user.service.js";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";

export type GraphDeps = {
  coreClient: CoreClient;
  normalizer: Normalizer;
  cache: DictionariesCache;
  userService?: UserService;
  checkpointService: CheckpointService;
};

type ConfigWithDeps = LangGraphRunnableConfig & {
  configurable: GraphDeps;
};

export function hasConfigDeps(config: LangGraphRunnableConfig): config is ConfigWithDeps {
  const c = config.configurable;
  return !!c && "coreClient" in c && "normalizer" in c && "cache" in c;
}

type ConfigWithUserService = ConfigWithDeps & {
  configurable: { coreClient: CoreClient; normalizer: Normalizer; userService: UserService };
};

export function hasUserService(config: LangGraphRunnableConfig): config is ConfigWithUserService {
  const c = config.configurable;
  return !!c && "coreClient" in c && "normalizer" in c && "userService" in c;
}

export { type DictionariesCache } from "../../services/dictionaries-cache.js";
