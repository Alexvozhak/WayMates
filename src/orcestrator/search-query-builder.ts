import {
  buildContextQuery,
  buildPipelineQuery,
  buildSimilarContextsCore,
} from "./cypher-builder.js";
import {
  buildCurrentContextStrictConditions,
  buildCurrentContextFlexibleConditions,
  buildTargetContextStrictConditions,
  buildTargetContextFlexibleConditions,
  buildPipelineCurrentStrictConditions,
  buildPipelineCurrentFlexibleConditions,
  buildPipelineTargetStrictConditions,
  buildPipelineTargetFlexibleConditions,
} from "./snippets-extractor.js";
import type {
  ContextField,
  SearchConstraints,
  CurrentOnlyParams,
  FlexibleField,
} from "../schemas-zod.js";
import { PRESETS, isPresetName } from "./presets.js";
import { REQUIRED_FIELDS_FOR_CURRENT_CONTEXT } from "../config.js";

const FINAL_BATCH_PERIOD = -1;

export class SearchQueryBuilder {
  public validateCurrentPresets(): void {
    for (const [name, config] of Object.entries(PRESETS)) {
      this.validateRequiredFields(name, config.strictFields);
    }
  }

  public constructCurrentContextQuery(
    orderedStrictFields: ContextField[],
    flexibleFields: FlexibleField[],
    searchConstraints: SearchConstraints
  ): string {
    const whereClause = buildCurrentContextStrictConditions(orderedStrictFields);
    const scoreClause = buildCurrentContextFlexibleConditions(flexibleFields);
    return buildContextQuery(
      "all",
      whereClause,
      scoreClause,
      searchConstraints
    );
  }

  public constructTargetContextQuery(
    orderedStrictFields: ContextField[],
    flexibleFields: FlexibleField[],
    searchConstraints: SearchConstraints
  ): string {
    const whereClause = buildTargetContextStrictConditions(orderedStrictFields);
    const scoreClause = buildTargetContextFlexibleConditions(flexibleFields);
    return buildContextQuery(
      "all",
      whereClause,
      scoreClause,
      searchConstraints,
      "$targetContext"  // Для Target Context Search используем $targetContext
    );
  }

  public constructPipelineQuery(
    orderedCurrentStrictFields: ContextField[],
    currentFlexibleFields: FlexibleField[],
    targetStrictFields: ContextField[],
    targetFlexibleFields: FlexibleField[],
    searchConstraints: SearchConstraints
  ): string {
    // Используем специализированные функции для pipeline
    const where1 = buildPipelineCurrentStrictConditions(orderedCurrentStrictFields);
    const score1 = buildPipelineCurrentFlexibleConditions(currentFlexibleFields);
    const where2 = buildPipelineTargetStrictConditions(targetStrictFields);
    const score2 = buildPipelineTargetFlexibleConditions(targetFlexibleFields);
    
    return buildPipelineQuery(
      where1,
      score1,
      where2,
      score2,
      searchConstraints
    );
  }

  //todo мб к нему и strictFields проверку добавить
  private validateRequiredFields(
    presetName: string,
    strictPresetFields: ContextField[]
  ): void {
    const hasRequiredFields = REQUIRED_FIELDS_FOR_CURRENT_CONTEXT.every(
      (field) => strictPresetFields.includes(field)
    );

    if (!hasRequiredFields) {
      throw new Error(
        `Current preset "${presetName}" must include all required fields: ${REQUIRED_FIELDS_FOR_CURRENT_CONTEXT.join(", ")}`
      );
    }
  }

  public buildCurrentBatchesQuery(params: CurrentOnlyParams): string {
    const periods = this.generatePeriods(params);

    const unionBlocks = periods
      .map((months) => this.generatePeriodBlock(months, params.currentPreset))
      .join("\nUNION\n");

    return `${unionBlocks}\nRETURN period, results`;
  }

  private generatePeriods(params: CurrentOnlyParams): number[] {
    const periods: number[] = [];

    for (let step = 1; step <= params.numberOfSteps; step++) {
      periods.push(step * params.stepSizeMonths);
    }

    if (params.includeFinalBatch) {
      periods.push(FINAL_BATCH_PERIOD);
    }

    return periods;
  }

  /** Generate single period block for batched query */
  private generatePeriodBlock(months: number, presetName: string): string {
    if (!isPresetName(presetName)) {
      throw new Error(`Invalid preset name: ${presetName}`);
    }
    const { strictFields, flexibleFields } = PRESETS[presetName]!;
    const whereClause = buildCurrentContextStrictConditions(strictFields);
    const scoreClause = buildCurrentContextFlexibleConditions(flexibleFields);

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
