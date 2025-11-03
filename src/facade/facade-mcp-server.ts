import { FastMCP } from 'fastmcp';
import { z } from 'zod';
import type { FacadeOrchestrator } from './facade-orchestrator.js';

const NLPQuerySchema = z.object({
  query: z.string().describe('Natural language query from user'),
  token: z.string().optional().describe('Authentication token (if returning user)'),
});

export function createFacadeServer(orchestrator: FacadeOrchestrator) {
  const server = new FastMCP({
    name: 'waymates-facade',
    version: '1.0.0',
    instructions: 'WayMates NLP interface. Single endpoint for all career operations.',
  });

  server.addTool({
    name: 'process',
    description: 'Process natural language query (search, story, goal)',
    parameters: NLPQuerySchema,
    execute: async (args: unknown) => {
      const { query, token } = NLPQuerySchema.parse(args);
      const result = await orchestrator.processQuery(query, token);
      return JSON.stringify(result, null, 2);
    },
  });

  return server;
}
