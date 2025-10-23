import type { Driver } from "neo4j-driver";
import type {
  UserContext,
  TargetContext,
  CurrentOnlyReasonParams,
  TargetOnlyReasonParams,
  ReasonCombination,
  GdsSimilaritySearchParams,
  ContextField,
  FlexibleField,
} from "./schemas-zod.js";
import {
  ReasonCombinationSchema,
  CurrentOnlyReasonParamsSchema,
  TargetOnlyReasonParamsSchema,
  GdsSimilaritySearchParamsSchema,
} from "./schemas-zod.js";
import { withReadSession } from "./neo4j.js";
import { SelectivityService } from "./services/selectivity.service.js";
import {
  CURRENT_PRESETS,
  TARGET_PRESETS,
  isCurrentPresetName,
  isTargetPresetName,
} from "./orcestrator/presets.js";
import { buildReasonBasedQuery } from "./orcestrator/reason-query-builder.js";
import { GdsSimilarityService } from "./gds/services/gds-similarity.service.js";
import { GdsPathfindingService } from "./gds/services/gds-pathfinding.service.js";
import { GdsProjectionService } from "./gds/services/gds-projection.service.js";
import type {
  PipelineWithPathfindingParams,
  PipelineWithPathfindingResult,
} from "./gds/schemas.js";

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
    private driver: Driver,
    private selectivity: SelectivityService,
    private gdsSimilarity: GdsSimilarityService,
    private gdsPathfinding: GdsPathfindingService,
    private gdsProjection: GdsProjectionService
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

    const result = await withReadSession(this.driver, (tx) =>
      tx.run(cypher, {
        searchContext,
        currentUserId,
        periodMonths,
        requiredReasons,
        excludedReasons,
      })
    );

    return result.records.map((rec) =>
      ReasonCombinationSchema.parse(rec.get("reason_combination_result"))
    );
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
      periodMonths: validatedParams.lookaheadMonths,
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
      periodMonths: validatedParams.lookbackMonths,
      requiredReasons: validatedParams.requiredReasons,
      excludedReasons: validatedParams.excludedReasons,
    });
  }

  async searchSimilarityBased(
    params: GdsSimilaritySearchParams
  ): Promise<Array<{ context_id: string; match_score: number }>> {
    const validatedParams = GdsSimilaritySearchParamsSchema.parse(params);

    await this.gdsProjection.ensureSkillsGraphProjection();

    const results = await this.gdsSimilarity.findSimilarBy(validatedParams);

    return results;
  }

  async searchPipeline(
    params: PipelineWithPathfindingParams
  ): Promise<PipelineWithPathfindingResult[]> {
    const { searchContextId, algorithm, topK, similarityCutoff, targetPosition, k } = params;

    const similarContexts = await this.searchSimilarityBased({
      searchContextId,
      algorithm,
      topK,
      similarityCutoff,
      filters: { position: targetPosition },
    });

    const results: PipelineWithPathfindingResult[] = [];
    for (const similar of similarContexts) {
      const paths = await this.gdsPathfinding.findKShortestPaths({
        sourceContextId: searchContextId,
        targetContextId: similar.context_id,
        k,
      });

      results.push({
        context_id: similar.context_id,
        match_score: similar.match_score,
        paths,
      });
    }

    return results;
  }
}
