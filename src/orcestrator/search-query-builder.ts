import { PresetsManager } from "./preset-manager.js";
import { buildContextQuery, buildPipelineQuery } from "./cypher-builder.js";
import {
  buildStrictConditions,
  buildFlexibleConditions,
} from "./snippets-extractor.js";
import type {
  QueryConfig,
  ContextField,
  SearchConstraints,
} from "../schemas-zod.js";

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
}
