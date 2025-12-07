import type { CoreClient } from "../../core-client.js";
import type { Normalizer } from "../../services/normalizer.js";
import type { UserService } from "../../services/user.service.js";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";

type ConfigWithDeps = LangGraphRunnableConfig & {
  configurable: { coreClient: CoreClient; normalizer: Normalizer; userService?: UserService };
};

export function hasConfigDeps(config: LangGraphRunnableConfig): config is ConfigWithDeps {
  const c = config.configurable;
  return !!c && "coreClient" in c && "normalizer" in c;
}

type ConfigWithUserService = ConfigWithDeps & {
  configurable: { coreClient: CoreClient; normalizer: Normalizer; userService: UserService };
};

export function hasUserService(config: LangGraphRunnableConfig): config is ConfigWithUserService {
  const c = config.configurable;
  return !!c && "coreClient" in c && "normalizer" in c && "userService" in c;
}
