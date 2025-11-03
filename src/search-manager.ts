import type {
  UserContext,
  TargetContext,
  CurrentOnlyReasonParams,
  TargetOnlyReasonParams,
  ReasonCombination,
  ContextField,
  FlexibleField,
} from "./schemas-zod.js";
import {
  ReasonCombinationSchema,
  CurrentOnlyReasonParamsSchema,
  TargetOnlyReasonParamsSchema,
} from "./schemas-zod.js";
import type { DatabaseContext } from "./database-context.js";
import { SelectivityService } from "./services/selectivity.service.js";
import {
  CURRENT_PRESETS,
  TARGET_PRESETS,
  isCurrentPresetName,
  isTargetPresetName,
} from "./orcestrator/presets.js";
import { buildReasonBasedQuery } from "./orcestrator/reason-query-builder.js";

type SearchDirection = "forward" | "backward";

interface ReasonBasedSearchConfig {
  direction: SearchDirection;
  presetConfig: {
    strictFields: ContextField[];
    flexibleFields: FlexibleField[];
  };
  searchContext: UserContext | TargetContext;
  currentUserId: string;
  periodMonths: number;
  requiredReasons: string[];
  excludedReasons: string[];
}

export class SearchManager {
  constructor(
    private db: DatabaseContext,
    private selectivity: SelectivityService
  ) {}

  private async searchReasonBasedInternal(
    config: ReasonBasedSearchConfig
  ): Promise<ReasonCombination[]> {
    const {
      direction,
      presetConfig,
      searchContext,
      currentUserId,
      periodMonths,
      requiredReasons,
      excludedReasons,
    } = config;

    const orderedStrictFields = await this.selectivity.rankStrictFields(
      presetConfig.strictFields,
      searchContext
    );

    const cypher = buildReasonBasedQuery(
      orderedStrictFields,
      presetConfig.flexibleFields,
      direction
    );

    return this.db.read(async (tx) => {
      const result = await tx.run(cypher, {
        searchContext,
        currentUserId,
        periodMonths,
        requiredReasons,
        excludedReasons,
      });

      return result.records.map((rec) =>
        ReasonCombinationSchema.parse(rec.get("reason_combination_result"))
      );
    });
  }

  async searchCurrentOnlyMode(
    params: CurrentOnlyReasonParams
  ): Promise<ReasonCombination[]> {
    const validatedParams = CurrentOnlyReasonParamsSchema.parse(params);

    if (!isCurrentPresetName(validatedParams.currentPreset)) {
      throw new Error(
        `Invalid current preset name: ${validatedParams.currentPreset}`
      );
    }

    const presetConfig = CURRENT_PRESETS[validatedParams.currentPreset]!;

    return this.searchReasonBasedInternal({
      direction: "forward",
      presetConfig,
      searchContext: validatedParams.currentContext,
      currentUserId: validatedParams.currentUserId,
      periodMonths: validatedParams.searchPeriodMonths,
      requiredReasons: validatedParams.requiredReasons,
      excludedReasons: validatedParams.excludedReasons,
    });
  }

  async searchTargetOnlyMode(
    params: TargetOnlyReasonParams
  ): Promise<ReasonCombination[]> {
    const validatedParams = TargetOnlyReasonParamsSchema.parse(params);

    if (!isTargetPresetName(validatedParams.targetPreset)) {
      throw new Error(
        `Invalid target preset name: ${validatedParams.targetPreset}`
      );
    }

    const presetConfig = TARGET_PRESETS[validatedParams.targetPreset]!;

    return this.searchReasonBasedInternal({
      direction: "backward",
      presetConfig,
      searchContext: validatedParams.targetContext,
      currentUserId: validatedParams.currentUserId,
      periodMonths: validatedParams.searchPeriodMonths,
      requiredReasons: validatedParams.requiredReasons,
      excludedReasons: validatedParams.excludedReasons,
    });
  }
}
