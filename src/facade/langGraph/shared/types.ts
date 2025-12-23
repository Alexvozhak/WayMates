import type { CoreClient } from "../../core-client.js";
import type { CheckpointService } from "../../services/checkpoint.service.js";
import type { DictionariesService } from "../../services/dictionaries.service.js";
import type { Normalizer } from "../../services/normalizer.js";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import type { Logger } from "pino";

export type GraphDeps = {
  coreClient: CoreClient;
  normalizerService: Normalizer;
  dictionariesService: DictionariesService;
  checkpointService: CheckpointService;
  logger: Logger;
};

type ConfigWithDeps = LangGraphRunnableConfig & {
  configurable: GraphDeps;
};

export function hasConfigDeps(config: LangGraphRunnableConfig): config is ConfigWithDeps {
  const c = config.configurable;
  return !!c && "coreClient" in c && "normalizerService" in c && "dictionariesService" in c && "logger" in c;
}

export { type DictionariesService } from "../../services/dictionaries.service.js";
