import { z } from 'zod';

import { sessionIdSchema } from '../../shared/result.js';

import { BaseTool } from './base-tool.js';

import type { SessionId } from '../../shared/result.js';
import type { UserId } from '../../shared/schemas.js';

export const getStoryParamsSchema = z.object({
  userId: z.string().optional(),
  sessionId: sessionIdSchema,
});

export type GetStoryParams = z.infer<typeof getStoryParamsSchema>;

export type StoryResult = {
  contexts: unknown[];
  trails: unknown[];
};

export class GetStoryTool extends BaseTool<GetStoryParams, StoryResult> {
  protected extractSessionId(params: GetStoryParams): SessionId {
    return params.sessionId;
  }

  protected async executeImpl(
    params: GetStoryParams,
    userId: UserId
  ): Promise<StoryResult> {
    const targetUserId = params.userId || userId;

    const result = await this.coreClient.get<StoryResult>(
      `/story/${targetUserId}`
    );

    return result;
  }
}
