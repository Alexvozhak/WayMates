import { FastMCP } from 'fastmcp';

import { getStoryParamsSchema, GetStoryTool } from './tools/get-story.tool.js';

import type { CoreRestClient } from './core-rest-client.js';
import type { SessionMiddleware } from './session-middleware.js';
import type { SimpleNormalizer } from './simple-normalizer.js';


export type FacadeServerDependencies = {
  sessionMiddleware: SessionMiddleware;
  normalizer: SimpleNormalizer;
  coreClient: CoreRestClient;
};

export function createFacadeServer(deps: FacadeServerDependencies): FastMCP {
  const server = new FastMCP({
    name: 'waymates-facade',
    version: '2.0.0',
    instructions: 'WayMates MCP Server. Provides 5 tools for career operations.',
  });

  const getStoryTool = new GetStoryTool(
    deps.sessionMiddleware,
    deps.normalizer,
    deps.coreClient
  );

  server.addTool({
    name: 'get_story',
    description: 'Get career story (contexts and trails) for a user',
    parameters: getStoryParamsSchema,
    execute: async (args: unknown) => {
      const params = getStoryParamsSchema.parse(args);
      const result = await getStoryTool.execute(params);

      if (result.ok) {
        return JSON.stringify(result.value, null, 2);
      }

      throw new Error(`${result.error.code}: ${result.error.message}`);
    },
  });

  return server;
}
