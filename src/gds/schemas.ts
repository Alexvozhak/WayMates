/**
 * Zod schemas for GDS (Graph Data Science) module
 *
 * This file defines validation schemas and TypeScript types for GDS-related data structures.
 * All types are derived from Zod schemas using z.infer<> for consistency and validation.
 */

import { z } from 'zod';

/**
 * Filters for GDS similarity search
 *
 * All filters are optional - used to constrain the target node set in GDS queries.
 * Values are matched against Context node properties.
 */
export const SimilarityFiltersSchema = z.object({
  position: z.string().optional(),
  industry: z.string().optional(),
  country_code: z.string().optional(),
  city_name: z.string().optional(),
  company_size: z.string().optional(),
  work_type: z.string().optional(),
});

export type SimilarityFilters = z.infer<typeof SimilarityFiltersSchema>;

/**
 * Result of GDS similarity search (single candidate)
 *
 * Returned by:
 * - GdsSimilarityService.findSimilarByJaccard()
 * - GdsSimilarityService.findSimilarByOverlap()
 */
export const SimilarityResultSchema = z.object({
  context_id: z.string(),
  match_score: z.number().min(0.0).max(1.0), // GDS similarity is always [0.0, 1.0]
});

export type SimilarityResult = z.infer<typeof SimilarityResultSchema>;

/**
 * Projection information returned by GDS
 *
 * Contains metadata about a graph projection in GDS catalog.
 * Used by GdsProjectionService for tracking projections.
 */
export const ProjectionInfoSchema = z.object({
  graphName: z.string(),
  nodeCount: z.number().int().nonnegative(),
  relationshipCount: z.number().int().nonnegative(),
  sizeInBytes: z.number().int().nonnegative(),
  createdAt: z.date(),
});

export type ProjectionInfo = z.infer<typeof ProjectionInfoSchema>;

/**
 * Pathfinding result from Yen's K-Shortest Paths
 *
 * Represents a single career transition path.
 * Will be used by GdsPathfindingService (Week 2).
 */
export const PathResultSchema = z.object({
  path_index: z.number().int().nonnegative(), // 0-based index (0 = shortest, 1 = 2nd shortest, etc.)
  contexts: z.array(z.string()), // Array of context_ids forming the path
  total_cost: z.number().nonnegative(), // Total path cost (sum of edge weights)
});

export type PathResult = z.infer<typeof PathResultSchema>;

/**
 * Parameters for finding K shortest paths between two contexts
 *
 * Used by:
 * - SearchManager.findKShortestPaths()
 * - MCP tool: find_k_shortest_paths
 */
export const GdsPathfindingParamsSchema = z.object({
  sourceContextId: z.string().describe('Starting context ID'),
  targetContextId: z.string().describe('Target context ID'),
  k: z
    .number()
    .int()
    .min(1)
    .max(10)
    .default(3)
    .describe('Number of shortest paths to find (default: 3, max: 10)'),
});

export type GdsPathfindingParams = z.infer<typeof GdsPathfindingParamsSchema>;

/**
 * Parameters for pipeline search with pathfinding
 *
 * Combines GDS similarity search (find similar contexts at target position)
 * with pathfinding (show K shortest career paths to reach them).
 *
 * Used by:
 * - SearchManager.searchPipelineWithPathfinding()
 * - MCP tool: find_pipeline_with_pathfinding
 */
export const PipelineWithPathfindingParamsSchema = z.object({
  searchContextId: z.string().describe('Starting context ID'),
  targetPosition: z.string().describe('Target position to reach'),
  algorithm: z
    .enum(['Jaccard', 'Overlap'])
    .describe('Similarity algorithm: Jaccard (strict) or Overlap (lenient)'),
  k: z
    .number()
    .int()
    .min(1)
    .max(10)
    .default(3)
    .describe('Number of paths per similar context (default: 3)'),
  topK: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(10)
    .describe('Max number of similar contexts to find (default: 10)'),
  similarityCutoff: z
    .number()
    .min(0.0)
    .max(1.0)
    .optional()
    .describe('Minimum similarity threshold (default: algorithm-specific)'),
});

export type PipelineWithPathfindingParams = z.infer<
  typeof PipelineWithPathfindingParamsSchema
>;

/**
 * Result of pipeline search with pathfinding
 *
 * Single candidate context with similarity score and career paths.
 *
 * Returned by:
 * - SearchManager.searchPipelineWithPathfinding()
 */
export const PipelineWithPathfindingResultSchema = z.object({
  context_id: z
    .string()
    .describe('Context ID of similar user at target position'),
  match_score: z
    .number()
    .min(0.0)
    .max(1.0)
    .describe('Similarity score from GDS Node Similarity'),
  paths: z
    .array(PathResultSchema)
    .describe(
      'K shortest career paths from search context to this context'
    ),
});

export type PipelineWithPathfindingResult = z.infer<
  typeof PipelineWithPathfindingResultSchema
>;

/**
 * KNN result (will be used in Phase 2)
 *
 * Result from K-Nearest Neighbors algorithm for numerical features.
 * Future use: age cohorts, temporal matching.
 */
export const KnnResultSchema = z.object({
  context_id: z.string(),
  similarity_score: z.number().min(0.0).max(1.0),
  distance: z.number().nonnegative(), // Euclidean or cosine distance
});

export type KnnResult = z.infer<typeof KnnResultSchema>;
