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
