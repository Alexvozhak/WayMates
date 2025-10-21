import {
  buildContextQuery,
  buildPipelineQuery,
  buildSimilarContextsCore,
} from "./cypher-builder.js";
import {
  buildContextStrictConditions,
  buildContextFlexibleConditions,
} from "./snippets-extractor.js";
import type {
  ContextField,
  SearchConstraints,
  FlexibleField,
} from "../schemas-zod.js";
import { CURRENT_PRESETS, isCurrentPresetName } from "./presets.js";
import { REQUIRED_FIELDS_FOR_CURRENT_CONTEXT } from "../config.js";

export class SearchQueryBuilder {
  public validateCurrentPresets(): void {
    // Валидация происходит автоматически при парсинге JSON через CurrentPresetsSchema
    // Эта функция оставлена для обратной совместимости
    for (const [name, config] of Object.entries(CURRENT_PRESETS)) {
      this.validateRequiredFields(name, config.strictFields);
    }
  }

  public constructCurrentContextQuery(
    orderedStrictFields: ContextField[],
    flexibleFields: FlexibleField[],
    searchConstraints: SearchConstraints
  ): string {
    const whereClause = buildContextStrictConditions(
      orderedStrictFields,
      "candidateContext",
      "$currentContext"
    );
    const scoreClause = buildContextFlexibleConditions(
      flexibleFields,
      "candidateContext",
      "$currentContext",
      "contextCompatibilityScore"
    );
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
    const whereClause = buildContextStrictConditions(
      orderedStrictFields,
      "candidateContext",
      "$targetContext"
    );
    const scoreClause = buildContextFlexibleConditions(
      flexibleFields,
      "candidateContext",
      "$targetContext",
      "contextCompatibilityScore"
    );
    return buildContextQuery(
      "all",
      whereClause,
      scoreClause,
      searchConstraints,
      "$targetContext"
    );
  }

  public constructPipelineQuery(
    orderedCurrentStrictFields: ContextField[],
    currentFlexibleFields: FlexibleField[],
    targetStrictFields: ContextField[],
    targetFlexibleFields: FlexibleField[],
    searchConstraints: SearchConstraints
  ): string {
    const where1 = buildContextStrictConditions(
      orderedCurrentStrictFields,
      "candidateCurrentContext",
      "$currentContext"
    );
    const score1 = buildContextFlexibleConditions(
      currentFlexibleFields,
      "candidateCurrentContext",
      "$currentContext",
      "currentContextCompatibilityScore"
    );
    const where2 = buildContextStrictConditions(
      targetStrictFields,
      "candidateTargetContext",
      "$targetContext"
    );
    const score2 = buildContextFlexibleConditions(
      targetFlexibleFields,
      "candidateTargetContext",
      "$targetContext",
      "targetContextCompatibilityScore"
    );

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
}
