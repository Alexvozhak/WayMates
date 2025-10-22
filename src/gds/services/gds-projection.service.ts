/**
 * GDS Projection Service
 *
 * Manages Neo4j GDS graph projection lifecycle for WayMates search.
 *
 * Projections created:
 * - waymates-skills-graph: For Node Similarity (Jaccard/Overlap on skills/domains)
 * - waymates-temporal-graph: For Yen's K-Shortest Paths (career transitions)
 *
 * Lifecycle strategy (Q5 decision):
 * - Create projection on-demand
 * - Drop after use (current approach)
 * - TODO: Optimize with TTL-based caching later
 */

import type { Driver } from 'neo4j-driver';
import { withReadSession, withWriteSession } from '../../neo4j.js';
import type { ProjectionInfo } from '../schemas.js';

export class GdsProjectionService {
  constructor(private driver: Driver) {}

  /**
   * Validate and parse count value from GDS result
   *
   * @throws Error if count is NaN, Infinity, negative, or non-integer
   */
  private validateCount(rawCount: unknown, fieldName: string): number {
    const count = Number(rawCount);

    // Check for NaN, Infinity, -Infinity
    if (!Number.isFinite(count)) {
      throw new Error(
        `Invalid ${fieldName} from GDS: ${rawCount} (expected finite number)`
      );
    }

    // Must be non-negative integer
    if (!Number.isInteger(count) || count < 0) {
      throw new Error(
        `Invalid ${fieldName} from GDS: ${count} (expected non-negative integer)`
      );
    }

    return count;
  }

  /**
   * Ensure skills/domains graph projection exists
   *
   * Used by: GdsSimilarityService for Node Similarity (Jaccard/Overlap)
   *
   * Graph structure:
   * - Nodes: Context, Skill, WorkDomain, SkillCategory
   * - Relationships: USES_SKILL, IN_WORK_DOMAIN (both UNDIRECTED)
   *
   * @returns Projection info (nodeCount, relationshipCount, etc.)
   */
  async ensureSkillsGraphProjection(): Promise<ProjectionInfo> {
    const graphName = 'waymates-skills-graph';

    // Check if already exists (idempotent)
    const exists = await this.projectionExists(graphName);
    if (exists) {
      console.log(`✅ [GDS] Projection '${graphName}' already exists, reusing`);
      return this.getProjectionInfo(graphName);
    }

    console.log(`🔧 [GDS] Creating projection '${graphName}'...`);

    try {
      const query = `
        CALL gds.graph.project(
          $graphName,
          ['Context', 'Skill', 'WorkDomain'],
          {
            USES_SKILL: { orientation: 'UNDIRECTED' },
            IN_WORK_DOMAIN: { orientation: 'UNDIRECTED' }
          }
        )
        YIELD graphName, nodeCount, relationshipCount
        RETURN graphName, nodeCount, relationshipCount
      `;

      const result = await withWriteSession(this.driver, (tx) =>
        tx.run(query, { graphName })
      );

      const record = result.records[0];
      if (!record) {
        throw new Error(`Failed to create projection '${graphName}': no result returned`);
      }

      const info: ProjectionInfo = {
        graphName: record.get('graphName'),
        nodeCount: this.validateCount(record.get('nodeCount'), 'nodeCount'),
        relationshipCount: this.validateCount(record.get('relationshipCount'), 'relationshipCount'),
        sizeInBytes: 0, // TODO: Calculate from nodeCount (approx formula)
        createdAt: new Date(),
      };

      console.log(
        `✅ [GDS] Created '${graphName}': ${info.nodeCount} nodes, ${info.relationshipCount} rels`
      );

      return info;
    } catch (error: unknown) {
      // Bug #13 fix: Handle race condition where concurrent request created projection first
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (errorMessage.includes('already exists')) {
        console.log(
          `⚠️ [GDS] Projection '${graphName}' created by concurrent request, reusing`
        );
        return this.getProjectionInfo(graphName);
      }

      // Unknown error - re-throw
      throw error;
    }
  }

  /**
   * Ensure temporal graph projection exists
   *
   * Used by: GdsPathfindingService for Yen's K-Shortest Paths
   *
   * Graph structure:
   * - Nodes: Context
   * - Relationships: NEXT (with duration_months weight)
   *
   * REQUIRES: duration_months property on [:NEXT] relationships
   * (Run migration 001_add_duration_months.cypher first!)
   *
   * @returns Projection info
   */
  async ensureTemporalGraphProjection(): Promise<ProjectionInfo> {
    const graphName = 'waymates-temporal-graph';

    const exists = await this.projectionExists(graphName);
    if (exists) {
      console.log(`✅ [GDS] Projection '${graphName}' already exists, reusing`);
      return this.getProjectionInfo(graphName);
    }

    console.log(`🔧 [GDS] Creating projection '${graphName}'...`);

    try {
      const query = `
        CALL gds.graph.project(
          $graphName,
          'Context',
          {
            NEXT: {
              properties: {
                duration_months: {
                  property: 'duration_months',
                  defaultValue: 12.0
                }
              }
            }
          }
        )
        YIELD graphName, nodeCount, relationshipCount
        RETURN graphName, nodeCount, relationshipCount
      `;

      const result = await withWriteSession(this.driver, (tx) =>
        tx.run(query, { graphName })
      );

      const record = result.records[0];
      if (!record) {
        throw new Error(`Failed to create projection '${graphName}': no result returned`);
      }

      const info: ProjectionInfo = {
        graphName: record.get('graphName'),
        nodeCount: this.validateCount(record.get('nodeCount'), 'nodeCount'),
        relationshipCount: this.validateCount(record.get('relationshipCount'), 'relationshipCount'),
        sizeInBytes: 0,
        createdAt: new Date(),
      };

      console.log(
        `✅ [GDS] Created temporal graph '${graphName}': ${info.nodeCount} nodes, ${info.relationshipCount} rels`
      );

      return info;
    } catch (error: unknown) {
      // Bug #13 fix: Handle race condition where concurrent request created projection first
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (errorMessage.includes('already exists')) {
        console.log(
          `⚠️ [GDS] Projection '${graphName}' created by concurrent request, reusing`
        );
        return this.getProjectionInfo(graphName);
      }

      // Unknown error - re-throw
      throw error;
    }
  }

  /**
   * Check if projection exists
   *
   * @param graphName - Name of the projection to check
   * @returns true if projection exists, false otherwise
   */
  async projectionExists(graphName: string): Promise<boolean> {
    const query = `
      CALL gds.graph.exists($graphName)
      YIELD exists
      RETURN exists
    `;

    const result = await withReadSession(this.driver, (tx) =>
      tx.run(query, { graphName })
    );

    return result.records[0]?.get('exists') ?? false;
  }

  /**
   * Get projection information
   *
   * @param graphName - Name of the projection
   * @returns Projection info
   * @throws Error if projection not found
   */
  async getProjectionInfo(graphName: string): Promise<ProjectionInfo> {
    const query = `
      CALL gds.graph.list($graphName)
      YIELD graphName, nodeCount, relationshipCount, creationTime, sizeInBytes
      RETURN graphName, nodeCount, relationshipCount, creationTime, sizeInBytes
    `;

    const result = await withReadSession(this.driver, (tx) =>
      tx.run(query, { graphName })
    );

    const record = result.records[0];
    if (!record) {
      throw new Error(`Projection '${graphName}' not found`);
    }

    return {
      graphName: record.get('graphName'),
      nodeCount: this.validateCount(record.get('nodeCount'), 'nodeCount'),
      relationshipCount: this.validateCount(record.get('relationshipCount'), 'relationshipCount'),
      sizeInBytes: this.validateCount(record.get('sizeInBytes') ?? 0, 'sizeInBytes'),
      createdAt: new Date(record.get('creationTime')),
    };
  }

  /**
   * Drop projection
   *
   * Part of Q5 lifecycle strategy: drop after each use.
   * TODO: Optimize with TTL-based caching later (final cleanup phase)
   *
   * @param graphName - Name of the projection to drop
   */
  async dropProjection(graphName: string): Promise<void> {
    const exists = await this.projectionExists(graphName);
    if (!exists) {
      console.log(`⚠️ [GDS] Projection '${graphName}' does not exist, skipping drop`);
      return;
    }

    const query = `
      CALL gds.graph.drop($graphName, false)
      YIELD graphName
      RETURN graphName
    `;

    await withWriteSession(this.driver, (tx) =>
      tx.run(query, { graphName })
    );

    console.log(`🗑️ [GDS] Dropped projection '${graphName}'`);
  }

  /**
   * List all projections (debugging)
   *
   * Useful for:
   * - Checking memory usage
   * - Detecting leaked projections
   * - Test cleanup verification
   *
   * @returns Array of projection info
   */
  async listProjections(): Promise<ProjectionInfo[]> {
    const query = `
      CALL gds.graph.list()
      YIELD graphName, nodeCount, relationshipCount, creationTime, sizeInBytes
      RETURN graphName, nodeCount, relationshipCount, creationTime, sizeInBytes
    `;

    const result = await withReadSession(this.driver, (tx) => tx.run(query));

    return result.records.map((record) => ({
      graphName: record.get('graphName'),
      nodeCount: Number(record.get('nodeCount')),
      relationshipCount: Number(record.get('relationshipCount')),
      sizeInBytes: Number(record.get('sizeInBytes') ?? 0),
      createdAt: new Date(record.get('creationTime')),
    }));
  }

  /**
   * Drop all projections (cleanup utility)
   *
   * Use case:
   * - Test cleanup (afterAll hooks)
   * - Emergency memory cleanup
   * - Development reset
   */
  async dropAllProjections(): Promise<void> {
    const projections = await this.listProjections();

    for (const proj of projections) {
      console.log(`🗑️ [GDS] Dropping projection '${proj.graphName}'...`);
      await this.dropProjection(proj.graphName);
    }

    console.log(`✅ [GDS] Dropped ${projections.length} projection(s)`);
  }
}
