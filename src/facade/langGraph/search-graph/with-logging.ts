import { createWithLogging } from "../shared/with-logging.js";

import type { NODE } from "./state.js";

export const withLogging = createWithLogging<typeof NODE>();
