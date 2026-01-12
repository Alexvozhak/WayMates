import { createLogger } from "@shared/logger.js";

import { config } from "./env.js";

export const logger = createLogger("core", {
  level: config.LOG_LEVEL,
  nodeEnv: config.NODE_ENV,
});
