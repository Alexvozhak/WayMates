import type { Driver } from "neo4j-driver";
import { PresetsManager } from "./preset-manager.js";
import { getOptimalFieldOrder } from "./selectivity-profiler.js";
import {
  buildCurrentToTargetQuery,
  buildTargetTransitionQuery,
} from "./cypher-builder.js";
import { buildQueryFromConfig } from "./snippets-extractor.js";
import type {
  UserContext,
  QueryConfig,
  ContextField as ContextField,
} from "../schemas-zod.js";

export class QueryOrchestrator {
  constructor(
    private presetsManager: PresetsManager,
    private driver: Driver
  ) {}

  async generateCurrentContextQuery(
    preset: string,
    userContext: UserContext
  ): Promise<string> {
    try {
      const { strictPresets, flexiblePresets }: QueryConfig =
        this.presetsManager.get(preset);

      let optimalOrder: ContextField[];
      try {
        optimalOrder = await getOptimalFieldOrder(
          this.driver,
          strictPresets,
          userContext
        );
      } catch {
        optimalOrder = strictPresets.map((s) => s.field);
      }

      const { whereClause, scoreClause } = buildQueryFromConfig(
        flexiblePresets,
        optimalOrder,
        "requestedCurrentContext",
        "dbCurrentContext"
      );

      const query = buildCurrentToTargetQuery(
        whereClause,
        scoreClause,
        "requestedCurrentContext",
        "dbCurrentContext"
      );
      return query;
    } catch (error) {
      throw new Error(`Failed to generate optimized query: ${error}`);
    }
  }

  async generateTargetContextQuery(preset: string): Promise<string> {
    try {
      const { strictPresets, flexiblePresets }: QueryConfig =
        this.presetsManager.get(preset);

      const optimalOrder: ContextField[] = strictPresets.map((s) => s.field);

      const { whereClause, scoreClause } = buildQueryFromConfig(
        flexiblePresets,
        optimalOrder,
        "requestedTargetContext",
        "dbTargetContext"
      );

      const query = await buildTargetTransitionQuery(
        whereClause,
        scoreClause,
        "requestedTargetContext",
        "dbTargetContext"
      );
      return query;
    } catch (error) {
      throw new Error(`Failed to generate target transition query: ${error}`);
    }
  }
}
