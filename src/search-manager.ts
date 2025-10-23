import type { Driver } from "neo4j-driver";
import { SearchQueryBuilder } from "./orcestrator/search-query-builder.js";
import type {
  UserContext,
  TargetContext,
  PipelineGraphResult,
  SearchConstraints,
  CurrentToTargetParams,
  CurrentOnlyReasonParams,
  TargetOnlyReasonParams,
  ReasonCombination,
  GdsSimilaritySearchParams,
} from "./schemas-zod.js";
import {
  ReasonCombinationSchema,
  CurrentOnlyReasonParamsSchema,
  TargetOnlyReasonParamsSchema,
  GdsSimilaritySearchParamsSchema,
} from "./schemas-zod.js";
import { PipelineGraphResultSchema } from "./schemas-zod.js";
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

/**
 * Search direction for reason-based queries
 * - forward: Current → Future (lookahead)
 * - backward: Target ← Past (lookback)
 */
type SearchDirection = "forward" | "backward";

/**
 * Internal parameters for unified reason-based search
 */
interface ReasonBasedSearchConfig {
  direction: SearchDirection;
  presetName: string;
  searchContext: UserContext | TargetContext;
  currentUserId: string;
  periodMonths: number;
  requiredReasons: string[];
  excludedReasons: string[];
  presetType: "current" | "target";
  methodName: string; // For error logging
  periodLabel: string; // For warning logging (lookahead_months / lookback_months)
}

export class SearchManager {
  constructor(
    private driver: Driver,
    private builder: SearchQueryBuilder,
    private selectivity: SelectivityService,
    private gdsSimilarity: GdsSimilarityService,
    private gdsPathfinding: GdsPathfindingService,
    private gdsProjection: GdsProjectionService
  ) {}

  async searchPipeline(
    params: CurrentToTargetParams
  ): Promise<PipelineGraphResult[]> {
    // Destructure params
    const {
      currentPreset,
      currentContext,
      targetPreset,
      targetContext,
      currentUserId,
      searchConstraints,
    } = params;

    if (!isCurrentPresetName(currentPreset)) {
      throw new Error(`Invalid current preset name: ${currentPreset}`);
    }
    if (!isTargetPresetName(targetPreset)) {
      throw new Error(`Invalid target preset name: ${targetPreset}`);
    }

    const currentPresetConfig = CURRENT_PRESETS[currentPreset]!;
    const targetPresetConfig = TARGET_PRESETS[targetPreset]!;

    const { flexibleFields: currentFF } = currentPresetConfig;
    const { flexibleFields: targetFF, strictFields: targetSF } =
      targetPresetConfig;

    const orderedCurrentFF = await this.selectivity.rankStrictFields(
      currentPresetConfig.strictFields,
      currentContext
    );

    const cypher = this.builder.constructPipelineQuery(
      orderedCurrentFF,
      currentFF,
      targetSF,
      targetFF,
      searchConstraints
    );

    const cypherParams = { currentContext, targetContext, me: currentUserId };

    const result = await withReadSession(this.driver, (tx) =>
      tx.run(cypher, cypherParams)
    );

    console.log(
      "✅ Pipeline query executed, records count:",
      result.records.length
    );

    const parsedResults = result.records.map((rec) => {
      const userId = rec.get("userId") as string;
      const currentScore = rec.get("currentScore") as number;
      const targetScore = rec.get("targetScore") as number;

      return PipelineGraphResultSchema.parse({
        user_id: userId,
        match_score: currentScore + targetScore,
        user_graph: {
          user: { user_id: userId },
          matched_current_context: rec.get("currentContext"),
          matched_target_context: rec.get("targetContext"),
        },
      });
    });

    return parsedResults;
  }

  /**
   * Unified reason-based search implementation (DRY refactoring)
   *
   * Handles both forward (current → future) and backward (target ← past) searches.
   *
   * @param config - Search configuration with direction, preset, context, etc.
   * @returns Array of ReasonCombination results
   */
  private async searchReasonBasedInternal(
    config: ReasonBasedSearchConfig
  ): Promise<ReasonCombination[]> {
    const {
      direction,
      presetName,
      searchContext,
      currentUserId,
      periodMonths,
      requiredReasons,
      excludedReasons,
      presetType,
      methodName,
      periodLabel,
    } = config;

    // Validate preset
    const presets = presetType === "current" ? CURRENT_PRESETS : TARGET_PRESETS;
    const isValidPreset =
      presetType === "current"
        ? isCurrentPresetName(presetName)
        : isTargetPresetName(presetName);

    if (!isValidPreset) {
      throw new Error(`Invalid ${presetType} preset name: ${presetName}`);
    }

    const presetConfig = presets[presetName]!;

    // Rank strict fields by selectivity
    const orderedStrictFields = await this.selectivity.rankStrictFields(
      presetConfig.strictFields,
      searchContext
    );

    const flexibleFields = presetConfig.flexibleFields;

    // Build reason-based query with specified direction
    const cypher = buildReasonBasedQuery(
      orderedStrictFields,
      flexibleFields,
      direction
    );

    const queryParams = {
      searchContext,
      currentUserId,
      periodMonths,
      requiredReasons,
      excludedReasons,
    };

    let result;
    try {
      result = await withReadSession(this.driver, (tx) =>
        tx.run(cypher, queryParams)
      );
    } catch (error) {
      console.error(
        `❌ [SearchManager.${methodName}] Query execution failed:`,
        error
      );
      console.error("Query:", cypher);
      console.error("Params:", queryParams);
      throw new Error(
        `Failed to execute reason-based search: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    console.log(
      "✅ Reason-based query executed, records count:",
      result.records.length
    );

    // Parse results using ReasonCombinationSchema
    const parsedResults = result.records.map((rec, index) => {
      const reasonCombinationResult = rec.get("reason_combination_result");

      if (!reasonCombinationResult) {
        console.error(
          `❌ [SearchManager.${methodName}] Record ${index} has null reason_combination_result`
        );
        throw new Error(
          `Invalid query result: reason_combination_result is null at index ${index}`
        );
      }

      try {
        return ReasonCombinationSchema.parse(reasonCombinationResult);
      } catch (error) {
        console.error(
          `❌ [SearchManager.${methodName}] Failed to parse record ${index}:`,
          error
        );
        console.error("Raw data:", reasonCombinationResult);
        throw error;
      }
    });

    if (parsedResults.length === 0) {
      console.warn(
        `⚠️ [SearchManager.${methodName}] No reason combinations found for the given criteria`
      );
      console.warn("Debug info:", {
        [periodLabel]: periodMonths,
        required_reasons: requiredReasons,
        excluded_reasons: excludedReasons,
        context: {
          position: searchContext.position,
          domains: searchContext.domains,
        },
      });
    }

    return parsedResults;
  }

  /**
   * Current-Only Search (Forward Lookahead)
   *
   * Finds reason combinations for transitions FROM current context.
   * Uses 'forward' direction to look ahead at future contexts.
   *
   * @param params - Current-only search parameters
   * @returns Array of reason combinations with statistics
   */
  async searchCurrentOnlyMode(
    params: CurrentOnlyReasonParams
  ): Promise<ReasonCombination[]> {
    // Validate all parameters including lookahead_months range
    const validatedParams = CurrentOnlyReasonParamsSchema.parse(params);

    return this.searchReasonBasedInternal({
      direction: "forward",
      presetName: validatedParams.currentPreset,
      searchContext: validatedParams.currentContext,
      currentUserId: validatedParams.currentUserId,
      periodMonths: validatedParams.lookaheadMonths,
      requiredReasons: validatedParams.requiredReasons,
      excludedReasons: validatedParams.excludedReasons,
      presetType: "current",
      methodName: "searchCurrentReasonBased",
      periodLabel: "lookahead_months",
    });
  }

  /**
   * Target-Only Search (Backward Lookback)
   *
   * Finds reason combinations for transitions TO target context.
   * Uses 'backward' direction to look back at past contexts.
   *
   * @param params - Target-only search parameters
   * @returns Array of reason combinations with statistics
   */
  async searchTargetOnlyMode(
    params: TargetOnlyReasonParams
  ): Promise<ReasonCombination[]> {
    // Validate all parameters including lookback_months range
    const validatedParams = TargetOnlyReasonParamsSchema.parse(params);

    return this.searchReasonBasedInternal({
      direction: "backward",
      presetName: validatedParams.targetPreset,
      searchContext: validatedParams.targetContext,
      currentUserId: validatedParams.currentUserId,
      periodMonths: validatedParams.lookbackMonths,
      requiredReasons: validatedParams.requiredReasons,
      excludedReasons: validatedParams.excludedReasons,
      presetType: "target",
      methodName: "searchTargetReasonBased",
      periodLabel: "lookback_months",
    });
  }

  async searchSimilarityBased(
    params: GdsSimilaritySearchParams
  ): Promise<Array<{ context_id: string; match_score: number }>> {
    const validatedParams = GdsSimilaritySearchParamsSchema.parse(params);

    // Ensure GDS skills graph projection exists
    await this.gdsProjection.ensureSkillsGraphProjection();

    // Call GDS Similarity service with validated params
    const results = await this.gdsSimilarity.findSimilarBy(validatedParams);

    console.log(`✅ [SearchManager] Found ${results.length} similar contexts`);

    return results;
  }

  async searchPipelineWithPathfinding(
    params: PipelineWithPathfindingParams
  ): Promise<PipelineWithPathfindingResult[]> {
    // Step 1: Find similar contexts using GDS Node Similarity
    const similarContexts = await this.searchSimilarityBased({
      searchContextId: params.searchContextId,
      algorithm: params.algorithm,
      topK: params.topK,
      similarityCutoff: params.similarityCutoff,
      filters: { position: params.targetPosition },
    });

    console.log(
      `✅ Found ${similarContexts.length} similar contexts at target position`
    );

    // Step 2: For each similar context, find K shortest paths from search context
    const results: PipelineWithPathfindingResult[] = [];
    for (const similar of similarContexts) {
      const paths = await this.gdsPathfinding.findKShortestPaths({
        sourceContextId: params.searchContextId,
        targetContextId: similar.context_id,
        k: params.k,
      });

      results.push({
        context_id: similar.context_id,
        match_score: similar.match_score,
        paths,
      });
    }

    console.log(`✅ Found paths for ${results.length} contexts`);
    return results;
  }
}
