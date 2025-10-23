/**
 * GDS Pathfinding Service
 *
 * Implements Yen's K-Shortest Paths algorithm for career transition analysis.
 *
 * Usage:
 * - findKShortestPaths(): Find K alternative paths between two contexts
 * - Pipeline mode: current → target (multiple scenarios)
 * - Current-only: forward lookahead (K possible directions)
 * - Target-only: backward (K starting positions)
 *
 * Graph:
 * - Uses waymates-temporal-graph projection (Context nodes)
 * - Relationships: NEXT with duration_months weight
 *
 * Metrics:
 * - Path cost: sum of duration_months along path edges
 * - Lower cost = faster career transition
 *
 * Security:
 * - All queries use parameterized inputs
 * - K parameter validated to prevent excessive memory usage
 */

import type { Driver } from 'neo4j-driver';
import { int } from 'neo4j-driver';
import { withReadSession } from '../../neo4j.js';
import { GdsProjectionService } from './gds-projection.service.js';
import type { PathResult } from '../schemas.js';

/**
 * Maximum allowed value for k parameter (number of paths)
 *
 * Prevents excessive memory usage. Yen's algorithm complexity is O(k*N^2).
 * Limiting to 10 paths is reasonable for career transition analysis.
 */
const MAX_K_PATHS = 10;

/**
 * Default number of paths to find
 *
 * 3 paths provides good diversity without overwhelming the user.
 */
const DEFAULT_K_PATHS = 3;

export class GdsPathfindingService {
  constructor(
    private driver: Driver,
    private projectionService: GdsProjectionService
  ) {}

  /**
   * Validate and parse path cost from GDS result
   *
   * @throws Error if cost is NaN, Infinity, or negative
   */
  private validatePathCost(rawCost: unknown, pathIndex: number): number {
    const cost = Number(rawCost);

    // Check for NaN, Infinity, -Infinity
    if (!Number.isFinite(cost)) {
      throw new Error(
        `Invalid totalCost from GDS for path ${pathIndex}: ${rawCost} (expected finite number)`
      );
    }

    // Cost must be non-negative (path duration in months)
    if (cost < 0) {
      throw new Error(
        `Negative totalCost for path ${pathIndex}: ${cost} (expected >= 0)`
      );
    }

    return cost;
  }

  /**
   * Validate and parse count value
   *
   * @throws Error if count is NaN, Infinity, negative, or non-integer
   */
  private validateCount(rawCount: unknown, fieldName: string): number {
    const count = Number(rawCount);

    // Check for NaN, Infinity, -Infinity
    if (!Number.isFinite(count)) {
      throw new Error(
        `Invalid ${fieldName}: ${rawCount} (expected finite number)`
      );
    }

    // Must be non-negative integer
    if (!Number.isInteger(count) || count < 0) {
      throw new Error(
        `Invalid ${fieldName}: ${count} (expected non-negative integer)`
      );
    }

    return count;
  }

  /**
   * Find K shortest paths between two contexts using Yen's algorithm
   *
   * Use cases:
   * - Pipeline mode: Find alternative career paths from current → target position
   * - Current-only: Forward lookahead (K possible next positions)
   * - Target-only: Backward (K common starting positions for achievers)
   *
   * Returns:
   * - K paths sorted by totalCost (shortest first)
   * - Each path contains: path_index (0-based), contexts (array of context_ids), total_cost
   *
   * Implementation:
   * - Uses GDS Yen's K-Shortest Paths algorithm (gds.shortestPath.yens.stream)
   * - Path cost = sum of duration_months along NEXT relationships
   * - Automatically validates source/target exist before running GDS
   * - Returns empty array if no paths exist
   *
   * @param sourceContextId - Starting context ID
   * @param targetContextId - Target context ID
   * @param k - Number of paths to find (default: 3, max: 10)
   * @returns Array of PathResult objects sorted by total_cost ASC
   */
  async findKShortestPaths(
    sourceContextId: string,
    targetContextId: string,
    k: number = DEFAULT_K_PATHS
  ): Promise<PathResult[]> {
    // Validate parameters
    if (!sourceContextId || sourceContextId.trim() === '') {
      throw new Error('sourceContextId is required and cannot be empty');
    }
    if (!targetContextId || targetContextId.trim() === '') {
      throw new Error('targetContextId is required and cannot be empty');
    }
    if (sourceContextId === targetContextId) {
      throw new Error('sourceContextId and targetContextId must be different');
    }
    if (k < 1) {
      throw new Error(`k must be >= 1, got: ${k}`);
    }
    if (k > MAX_K_PATHS) {
      throw new Error(`k must be <= ${MAX_K_PATHS}, got: ${k}`);
    }

    // 1. Ensure temporal graph projection exists
    await this.projectionService.ensureTemporalGraphProjection();

    // 2. Validate source and target contexts exist
    const validateQuery = `
      MATCH (source:Context {context_id: $sourceContextId})
      MATCH (target:Context {context_id: $targetContextId})
      RETURN source.context_id AS source_id, target.context_id AS target_id
    `;
    const validateResult = await withReadSession(this.driver, (tx) =>
      tx.run(validateQuery, { sourceContextId, targetContextId })
    );

    if (validateResult.records.length === 0) {
      // One or both contexts not found
      const sourceQuery = `MATCH (c:Context {context_id: $sourceContextId}) RETURN c`;
      const targetQuery = `MATCH (c:Context {context_id: $targetContextId}) RETURN c`;

      const sourceExists = await withReadSession(this.driver, (tx) =>
        tx.run(sourceQuery, { sourceContextId })
      );
      const targetExists = await withReadSession(this.driver, (tx) =>
        tx.run(targetQuery, { targetContextId })
      );

      if (sourceExists.records.length === 0) {
        throw new Error(`Source context ${sourceContextId} not found`);
      }
      if (targetExists.records.length === 0) {
        throw new Error(`Target context ${targetContextId} not found`);
      }
    }

    // 3. Run Yen's K-Shortest Paths via GDS
    const query = `
      MATCH (source:Context {context_id: $sourceContextId})
      MATCH (target:Context {context_id: $targetContextId})
      CALL gds.shortestPath.yens.stream('waymates-temporal-graph', {
        sourceNode: source,
        targetNode: target,
        k: $k,
        relationshipWeightProperty: 'duration_months'
      })
      YIELD index, totalCost, nodeIds, path
      WITH index, totalCost, nodeIds,
           [nodeId IN nodeIds | gds.util.asNode(nodeId)] AS pathNodes
      RETURN
        index AS path_index,
        [node IN pathNodes | node.context_id] AS contexts,
        totalCost AS total_cost
      ORDER BY total_cost ASC
    `;

    const result = await withReadSession(this.driver, (tx) =>
      tx.run(query, {
        sourceContextId,
        targetContextId,
        k: int(k),  // GDS requires Integer, not Double
      })
    );

    if (result.records.length === 0) {
      console.log(`   ⚠️ No paths found between ${sourceContextId} and ${targetContextId}`);
      return [];
    }

    console.log(`   ✅ Found ${result.records.length} path(s)`);

    // Parse results
    return result.records.map((rec) => {
      const pathIndex = this.validateCount(rec.get('path_index'), 'path_index');
      const contexts = rec.get('contexts') as string[];
      const totalCost = this.validatePathCost(rec.get('total_cost'), pathIndex);

      return {
        path_index: pathIndex,
        contexts: contexts,
        total_cost: totalCost,
      };
    });
  }
}
