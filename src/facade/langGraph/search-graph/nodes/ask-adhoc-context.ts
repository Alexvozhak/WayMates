import { interrupt } from "@langchain/langgraph";

import { NODE, PHASE } from "../state.js";
import { withLogging } from "../with-logging.js";

import type { AdhocContextBase } from "../../../../../private/schemas.js";
import type { SearchStateType } from "../state.js";

function formatContextStatus(ctx: AdhocContextBase): { filled: string[]; missing: string[] } {
  const filled: string[] = [];
  const missing: string[] = [];

  if (ctx.role) filled.push(`role: ${ctx.role}`);
  else missing.push("role");

  if (ctx.position) filled.push(`position: ${ctx.position}`);
  else missing.push("position");

  if (ctx.domains && ctx.domains.length > 0) filled.push(`domain: ${ctx.domains.join(", ")}`);
  else missing.push("domain");

  if (ctx.countryCode) filled.push(`country: ${ctx.countryCode}`);
  else missing.push("country");

  return { filled, missing };
}

function buildAskMessage(ctx: AdhocContextBase | null): string {
  if (!ctx) {
    return `For search I need: position, role, domain, country`;
  }

  const { filled, missing } = formatContextStatus(ctx);
  const parts: string[] = [];

  if (filled.length > 0) parts.push(`Got: ${filled.join(", ")}`);
  if (missing.length > 0) parts.push(`Missing: ${missing.join(", ")}`);

  return parts.join("\n");
}

/**
 * Ask adhoc context node: requests user to provide context for adhoc search.
 * Triggered when startAdhoc intent received but no valid context extracted.
 * Shows what's already filled and what's missing.
 */
export const askAdhocContextNode = withLogging<SearchStateType>(NODE.ask_adhoc_context, (state) => {
  const message = buildAskMessage(state.adhocContext);

  const userResponse = interrupt({
    type: PHASE.asking_adhoc_context,
    message,
    phase: PHASE.asking_adhoc_context,
  });

  return {
    userResponse: String(userResponse),
    phase: PHASE.asking_adhoc_context,
  };
});
