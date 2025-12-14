import { SearchGraph } from "../../../../../src/facade/langGraph/search-graph/search-graph.js";
import { FacadeTestContext } from "../../../helpers/test-context.js";

import type { CoreClient } from "../../../../../src/facade/core-client.js";
import type { CreateGoalInput, UserId } from "../../../../../src/shared/schemas.js";

export async function setupUserWithGoal(coreClient: CoreClient, params: CreateGoalInput): Promise<void> {
  await coreClient.client.goal.set.mutate(params);
}

export async function cleanupUserGoal(coreClient: CoreClient, userId: UserId): Promise<void> {
  await coreClient.client.goal.delete.mutate({ userId });
}

export function runSearchGraph(message: string, threadId: string, userId: UserId) {
  const ctx = FacadeTestContext.getInstance();
  const graph = new SearchGraph(ctx.getGraphDeps());
  return graph.run(message, threadId, userId, null);
}
