import type { Driver } from "neo4j-driver";
import { PresetsManager } from "./preset-manager.js";
import { getOptimalFieldOrder } from "./selectivity-profiler.js";
import {
  buildCurrentToTargetQuery,
  buildTargetTransitionQuery,
} from "./cypher-builder.js";
import {
  buildStrictConditions,
  buildFlexibleScoring,
} from "./snippets-extractor.js";
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

      let strictFieldsInOptimalOrder: ContextField[];
      try {
        strictFieldsInOptimalOrder = await getOptimalFieldOrder(
          this.driver,
          strictPresets,
          userContext
        );
      } catch {
        strictFieldsInOptimalOrder = strictPresets.map((s) => s.field);
      }

      const whereClause = buildStrictConditions(strictFieldsInOptimalOrder);
      const scoreClause = buildFlexibleScoring(flexiblePresets);

      const query = buildCurrentToTargetQuery(whereClause, scoreClause);
      return query;
    } catch (error) {
      throw new Error(`Failed to generate optimized query: ${error}`);
    }
  }

  generateTargetContextQuery(preset: string): string {
    try {
      const { strictPresets, flexiblePresets }: QueryConfig =
        this.presetsManager.get(preset);

      const strictFields: ContextField[] = strictPresets.map((s) => s.field);

      const whereClause = buildStrictConditions(strictFields);
      const scoreClause = buildFlexibleScoring(flexiblePresets);

      const query = buildTargetTransitionQuery(whereClause, scoreClause);
      return query;
    } catch (error) {
      throw new Error(`Failed to generate target transition query: ${error}`);
    }
  }
}
