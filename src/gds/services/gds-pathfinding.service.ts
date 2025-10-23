import type { Driver } from "neo4j-driver";
import { int } from "neo4j-driver";
import { z } from "zod";
import { withReadSession } from "../../neo4j.js";
import { GdsProjectionService } from "./gds-projection.service.js";
import type { PathResult } from "../schemas.js";
import { GdsPathfindingParamsSchema } from "../schemas.js";

const MAX_K_PATHS = 10;
const DEFAULT_K_PATHS = 3;
export class GdsPathfindingService {
  constructor(
    private driver: Driver,
    private projectionService: GdsProjectionService
  ) {}

  private validatePathCost(rawCost: unknown, pathIndex: number): number {
    const cost = Number(rawCost);

    if (!Number.isFinite(cost)) {
      throw new Error(
        `Invalid totalCost from GDS for path ${pathIndex}: ${rawCost} (expected finite number)`
      );
    }

    if (cost < 0) {
      throw new Error(
        `Negative totalCost for path ${pathIndex}: ${cost} (expected >= 0)`
      );
    }

    return cost;
  }

  private validateCount(rawCount: unknown, fieldName: string): number {
    const count = Number(rawCount);

    if (!Number.isFinite(count)) {
      throw new Error(
        `Invalid ${fieldName}: ${rawCount} (expected finite number)`
      );
    }

    if (!Number.isInteger(count) || count < 0) {
      throw new Error(
        `Invalid ${fieldName}: ${count} (expected non-negative integer)`
      );
    }

    return count;
  }

  async findKShortestPaths(
    params: z.input<typeof GdsPathfindingParamsSchema>
  ): Promise<PathResult[]> {
    const { sourceContextId, targetContextId, k = DEFAULT_K_PATHS } = params;

    if (!sourceContextId || sourceContextId.trim() === "") {
      throw new Error("sourceContextId is required and cannot be empty");
    }
    if (!targetContextId || targetContextId.trim() === "") {
      throw new Error("targetContextId is required and cannot be empty");
    }
    if (sourceContextId === targetContextId) {
      throw new Error("sourceContextId and targetContextId must be different");
    }
    if (k < 1) {
      throw new Error(`k must be >= 1, got: ${k}`);
    }
    if (k > MAX_K_PATHS) {
      throw new Error(`k must be <= ${MAX_K_PATHS}, got: ${k}`);
    }

    await this.projectionService.ensureTemporalGraphProjection();

    const validateQuery = `
      MATCH (source:Context {context_id: $sourceContextId})
      MATCH (target:Context {context_id: $targetContextId})
      RETURN source.context_id AS source_id, target.context_id AS target_id
    `;
    const validateResult = await withReadSession(this.driver, (tx) =>
      tx.run(validateQuery, { sourceContextId, targetContextId })
    );

    if (validateResult.records.length === 0) {
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
        k: int(k), // GDS requires Integer, not Double
      })
    );

    if (result.records.length === 0) {
      return [];
    }

    return result.records.map((rec) => {
      const pathIndex = this.validateCount(rec.get("path_index"), "path_index");
      const contexts = rec.get("contexts") as string[];
      const totalCost = this.validatePathCost(rec.get("total_cost"), pathIndex);

      return {
        path_index: pathIndex,
        contexts: contexts,
        total_cost: totalCost,
      };
    });
  }
}
