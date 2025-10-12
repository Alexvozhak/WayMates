import { PresetsManager } from "./preset-manager.js";
import {
  buildContextQuery,
  buildPipelineQuery,
  buildSimilarContextsCore,
} from "./cypher-builder.js";
import {
  buildStrictConditions,
  buildFlexibleConditions,
} from "./snippets-extractor.js";
import type {
  QueryConfig,
  ContextField,
  SearchConstraints,
  CurrentOnlyParams,
} from "../schemas-zod.js";
import { FINAL_BATCH_PERIOD } from "../schemas-zod.js";
//todo перенести в app.ts
const REQUIRED_FIELDS_FOR_CURRENT_CONTEXT: ContextField[] = [
  "position",
  "domains",
  "skills",
];

export class SearchQueryBuilder {
  constructor(private presetsManager: PresetsManager) {}
  public validateCurrentPresets(): void {
    for (const name of this.presetsManager.list()) {
      const { strictFields } = this.presetsManager.get(name);
      this.validateRequiredFields(name, strictFields);
    }
  }

  /** Build Cypher for current-only search */
  public buildCurrentContextQuery(
    presetName: string,
    searchConstraints: SearchConstraints
  ): string {
    const { strictFields, flexibleFields }: QueryConfig =
      this.presetsManager.get(presetName);
    const whereClause = buildStrictConditions(strictFields);
    const scoreClause = buildFlexibleConditions(flexibleFields);
    // Forward searchConstraints for future filtering
    return buildContextQuery(
      "all",
      whereClause,
      scoreClause,
      searchConstraints
    );
  }

  /** Build Cypher for target-only (filtered) search */
  public buildTargetContextQuery(
    presetName: string,
    searchConstraints: SearchConstraints
  ): string {
    const { strictFields, flexibleFields }: QueryConfig =
      this.presetsManager.get(presetName);
    const whereClause = buildStrictConditions(strictFields);
    const scoreClause = buildFlexibleConditions(flexibleFields);
    return buildContextQuery(
      "filtered",
      whereClause,
      scoreClause,
      searchConstraints
    );
  }

  /** Build Cypher for current-to-target pipeline */
  public buildPipelineQuery(
    currentPreset: string,
    targetPreset: string,
    searchConstraints: SearchConstraints
  ): string {
    const { strictFields: sf1, flexibleFields: ff1 }: QueryConfig =
      this.presetsManager.get(currentPreset);
    const { strictFields: sf2, flexibleFields: ff2 }: QueryConfig =
      this.presetsManager.get(targetPreset);
    const where1 = buildStrictConditions(sf1);
    const score1 = buildFlexibleConditions(ff1);
    const where2 = buildStrictConditions(sf2);
    const score2 = buildFlexibleConditions(ff2);
    return buildPipelineQuery(
      where1,
      score1,
      where2,
      score2,
      searchConstraints
    );
  }

  private validateRequiredFields(
    preset: string,
    strictPresetFields: ContextField[]
  ): void {
    const hasRequiredFields = REQUIRED_FIELDS_FOR_CURRENT_CONTEXT.every(
      (field) => strictPresetFields.includes(field)
    );

    if (!hasRequiredFields) {
      throw new Error(
        `Current preset "${preset}" must include all required fields: ${REQUIRED_FIELDS_FOR_CURRENT_CONTEXT.join(", ")}`
      );
    }
  }

  /** Build Cypher for current-only search with time batches */
  public buildCurrentBatchesQuery(params: CurrentOnlyParams): string {
    // Generate periods array
    const periods = this.generatePeriods(params);

    // Generate UNION blocks for each period
    const unionBlocks = periods
      .map((months) => this.generatePeriodBlock(months, params.currentPreset))
      .join("\nUNION\n");

    return unionBlocks;
  }

  /** Generate periods array for batched search */
  private generatePeriods(params: CurrentOnlyParams): number[] {
    const periods: number[] = [];

    // Generate detailed periods: stepSize*1, stepSize*2, stepSize*3, etc.
    for (let step = 1; step <= params.numberOfSteps; step++) {
      periods.push(step * params.stepSizeMonths);
    }

    // Add final batch if requested
    if (params.includeFinalBatch) {
      periods.push(FINAL_BATCH_PERIOD);
    }

    return periods;
  }

  /** Generate single period block for batched query */
  private generatePeriodBlock(months: number, presetName: string): string {
    const { strictFields, flexibleFields }: QueryConfig =
      this.presetsManager.get(presetName);
    const whereClause = buildStrictConditions(strictFields);
    const scoreClause = buildFlexibleConditions(flexibleFields);

    // Use core logic for finding similar contexts
    const { cypherCode, userVar, contextVar, compatibilityScoreVar } =
      buildSimilarContextsCore("all", whereClause, scoreClause);

    const isFinalBatch = months === FINAL_BATCH_PERIOD;
    const futureContextCondition = isFinalBatch
      ? `datetime(futureContext.created_at) >= datetime(${contextVar}.created_at)`
      : `duration.between(datetime(${contextVar}.created_at), datetime(futureContext.created_at)).months >= ${months}`;

    // Элегантное пересечение массивов вместо TRIGGER_SNIPPETS
    return `
CALL {
  ${cypherCode}
  
  MATCH (${userVar})-[:HAS_CONTEXT]->(futureContext:Context)
  WHERE ${futureContextCondition}
  
  WITH ${userVar}, ${contextVar}, futureContext, ${compatibilityScoreVar},
       [reason IN $reasonsToTrack WHERE reason IN futureContext.creation_reason] AS contextTriggers
  
  RETURN ${months} AS period, collect({
            userId: ${userVar}.user_id,
            currentLikeContextId: ${contextVar}.context_id,
            compatibilityPercent: ${compatibilityScoreVar},
            transitionContextId: futureContext.context_id,
            contextTriggers: contextTriggers,
            monthsInPositionBeforeChange: duration.between(datetime(${contextVar}.created_at), datetime(futureContext.created_at)).months,
            ageAtPositionChange: datetime(futureContext.created_at).year - ${userVar}.birth_year,
            destinationCountry: futureContext.country_code,
            destinationCity: futureContext.city_name,
            companyTypeTransition: futureContext.company_size,
            industryTransition: futureContext.industry,
            techStackTransition: futureContext.domains,
            workFormatTransition: futureContext.work_type
  }) AS results
}`;
  }
}
