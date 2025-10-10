import type { Driver } from "neo4j-driver";
import { PresetsManager } from "./preset-manager.js";
import { getOptimalFieldOrder } from "./selectivity-profiler.js";
import {
  buildCurrentContextQuery,
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
  StrictPreset,
  FlexiblePreset,
} from "../schemas-zod.js";

const REQUIRED_FIELDS_FOR_CURRENT_CONTEXT: ContextField[] = [
  "position",
  "domains",
  "skills",
];

export class QueryOrchestrator {
  constructor(
    private presetsManager: PresetsManager,
    private driver: Driver
  ) {}

  private validateRequiredFields(
    preset: string,
    strictPresets: StrictPreset[]
  ): void {
    const strictPresetFields: ContextField[] = strictPresets.map(
      (p) => p.field
    );
    const hasRequiredFields = REQUIRED_FIELDS_FOR_CURRENT_CONTEXT.every(
      (field) => strictPresetFields.includes(field)
    );

    if (!hasRequiredFields) {
      throw new Error(
        `Current preset "${preset}" must include all required fields: ${REQUIRED_FIELDS_FOR_CURRENT_CONTEXT.join(", ")}`
      );
    }
  }

  private async optimizeFieldOrder(
    strictPresets: StrictPreset[],
    userContext: UserContext
  ): Promise<ContextField[]> {
    const strictPresetFields: ContextField[] = strictPresets.map(
      (p) => p.field
    );

    let strictFieldsInOptimalOrder: ContextField[];
    try {
      strictFieldsInOptimalOrder = await getOptimalFieldOrder(
        this.driver,
        strictPresetFields,
        userContext
      );
    } catch {
      strictFieldsInOptimalOrder = strictPresets.map((s) => s.field);
    }

    return strictFieldsInOptimalOrder;
  }

  private buildQueryClauses(
    strictPresets: StrictPreset[],
    flexiblePresets: FlexiblePreset[],
    searchCtx: string,
    candidateCtx: string
  ): { whereClause: string; scoreClause: string } {
    const whereClause = buildStrictConditions(
      strictPresets.map((s) => s.field),
      searchCtx,
      candidateCtx
    );
    const scoreClause = buildFlexibleScoring(
      flexiblePresets,
      searchCtx,
      candidateCtx
    );

    return { whereClause, scoreClause };
  }

  async generateCurrentContextQuery(
    preset: string,
    userContext: UserContext
  ): Promise<string> {
    try {
      const { strictPresets, flexiblePresets }: QueryConfig =
        this.presetsManager.get(preset);

      this.validateRequiredFields(preset, strictPresets);
      const strictFieldsInOptimalOrder = await this.optimizeFieldOrder(
        strictPresets,
        userContext
      );

      const optimizedStrictPresets = strictPresets.filter((preset) =>
        strictFieldsInOptimalOrder.includes(preset.field)
      );

      const { whereClause, scoreClause } = this.buildQueryClauses(
        optimizedStrictPresets,
        flexiblePresets,
        "requestedCurrentContext",
        "dbCurrentContext"
      );

      const query = buildCurrentContextQuery(whereClause, scoreClause);
      return query;
    } catch (error) {
      throw new Error(`Failed to generate current context query: ${error}`);
    }
  }

  generateTargetContextQuery(preset: string): string {
    try {
      const { strictPresets, flexiblePresets }: QueryConfig =
        this.presetsManager.get(preset);

      const { whereClause, scoreClause } = this.buildQueryClauses(
        strictPresets,
        flexiblePresets,
        "requestedTargetContext",
        "dbTargetContext"
      );

      const query = buildTargetTransitionQuery(whereClause, scoreClause);
      return query;
    } catch (error) {
      throw new Error(`Failed to generate target context query: ${error}`);
    }
  }
}
