import type { UserContext, UserId } from "../../../../private/schemas.js";
import type { CoreClient } from "../../core-client.js";

export async function loadCurrentContext(coreClient: CoreClient, userId: UserId): Promise<UserContext | null> {
  const story = await coreClient.client.story.getStory.query({ userId });
  const current = story.contexts.find((ctx) => ctx.nextContextId === null);
  return current ?? null;
}
