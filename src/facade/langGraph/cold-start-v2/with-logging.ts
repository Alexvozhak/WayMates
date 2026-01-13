import { createWithLogging } from "../shared/with-logging.js";

import type { NODE } from "./types.js";

export const withLogging = createWithLogging<typeof NODE>();
