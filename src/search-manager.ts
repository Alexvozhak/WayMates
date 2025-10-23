import type { Driver } from "neo4j-driver";
import { SearchQueryBuilder } from "./orcestrator/search-query-builder.js";
import type {
  UserContext,
  TargetContext,
  PipelineGraphResult,
  SearchConstraints,
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
  isTargetPresetName
} from "./orcestrator/presets.js";
import { buildReasonBasedQuery } from "./orcestrator/reason-query-builder.js";
import { GdsSimilarityService } from "./gds/services/gds-similarity.service.js";
import { GdsPathfindingService } from "./gds/services/gds-pathfinding.service.js";
import { GdsProjectionService } from "./gds/services/gds-projection.service.js";
import { ReasonAnalyticsService } from "./services/reason-analytics.service.js";
import type {
  DurationByReasonResult,
  ReasonTransitionResult,
  ReasonCooccurrenceResult,
} from "./services/reason-analytics.service.js";
import type { PathResult } from "./gds/schemas.js";

export class SearchManager {
  constructor(
    private driver: Driver,
    private builder: SearchQueryBuilder,
    private selectivity: SelectivityService,
    private gdsSimilarity: GdsSimilarityService,
    private gdsPathfinding: GdsPathfindingService,
    private gdsProjection: GdsProjectionService,
    private reasonAnalytics: ReasonAnalyticsService
  ) {}

  async searchPipeline(
    currentPreset: string,
    currentContext: UserContext,
    targetPreset: string,
    targetContext: TargetContext,
    currentUserId: string,
    searchConstraints: SearchConstraints
  ): Promise<PipelineGraphResult[]> {
    console.log("🔀 [SearchManager.searchPipeline] Starting pipeline search");
    console.log("📊 Input params:", {
      currentPreset,
      targetPreset,
      currentUserId,
      currentContext: {
        context_id: currentContext.context_id,
        position: currentContext.position,
        domains: currentContext.domains,
        skills: currentContext.skills?.slice(0, 3),
        country_code: currentContext.country_code,
      },
      targetContext: {
        context_id: targetContext.context_id,
        position: targetContext.position,
        domains: targetContext.domains,
        skills: targetContext.skills?.slice(0, 3),
        country_code: targetContext.country_code,
      },
      searchConstraints,
    });

    if (!isCurrentPresetName(currentPreset)) {
      throw new Error(`Invalid current preset name: ${currentPreset}`);
    }
    if (!isTargetPresetName(targetPreset)) {
      throw new Error(`Invalid target preset name: ${targetPreset}`);
    }

    const currentPresetConfig = CURRENT_PRESETS[currentPreset]!;
    const targetPresetConfig = TARGET_PRESETS[targetPreset]!;
    console.log("⚙️ Current preset config:", currentPresetConfig);
    console.log("⚙️ Target preset config:", targetPresetConfig);

    const { flexibleFields: currentFF } = currentPresetConfig;
    const { flexibleFields: targetFF, strictFields: targetSF } =
      targetPresetConfig;

    const orderedCurrentFF = await this.selectivity.rankStrictFields(
      currentPresetConfig.strictFields,
      currentContext
    );
    console.log("📋 Ordered current strict fields:", orderedCurrentFF);
    console.log("🎯 Current flexible fields:", currentFF);
    console.log("📋 Target strict fields:", targetSF);
    console.log("🎯 Target flexible fields:", targetFF);

    const cypher = this.builder.constructPipelineQuery(
      orderedCurrentFF,
      currentFF,
      targetSF,
      targetFF,
      searchConstraints
    );

    console.log("🔗 Generated Pipeline Cypher Query:");
    console.log("─".repeat(80));
    console.log(cypher);
    console.log("─".repeat(80));

    const params = { currentContext, targetContext, me: currentUserId };
    console.log("📦 Query parameters:", {
      me: params.me,
      currentContext: {
        context_id: params.currentContext.context_id,
        position: params.currentContext.position,
        domains: params.currentContext.domains,
        skills: params.currentContext.skills?.slice(0, 3),
      },
      targetContext: {
        context_id: params.targetContext.context_id,
        position: params.targetContext.position,
        domains: params.targetContext.domains,
        skills: params.targetContext.skills?.slice(0, 3),
      },
    });

    const result = await withReadSession(this.driver, (tx) =>
      tx.run(cypher, params)
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

    console.log(
      "🎯 Pipeline results:",
      parsedResults.map((r) => ({
        user_id: r.user_id,
        match_score: r.match_score,
      }))
    );

    return parsedResults;
  }

  async searchCurrentOnlyMode(
    params: CurrentOnlyReasonParams
  ): Promise<ReasonCombination[]> {
    // Validate all parameters including lookahead_months range
    const validatedParams = CurrentOnlyReasonParamsSchema.parse(params);

    console.log(
      "🎯 [SearchManager.searchCurrentOnlyMode] Starting current-only search (grouped by reasons)"
    );
    console.log("📊 Input params:", {
      currentUserId: validatedParams.currentUserId,
      currentPreset: validatedParams.currentPreset,
      lookahead_months: validatedParams.lookahead_months,
      required_reasons: validatedParams.required_reasons,
      excluded_reasons: validatedParams.excluded_reasons,
      currentContext: {
        position: validatedParams.currentContext.position,
        domains: validatedParams.currentContext.domains,
        skills: validatedParams.currentContext.skills?.slice(0, 3),
        country_code: validatedParams.currentContext.country_code,
      },
    });

    // Validate preset
    if (!isCurrentPresetName(validatedParams.currentPreset)) {
      throw new Error(`Invalid current preset name: ${validatedParams.currentPreset}`);
    }

    const presetConfig = CURRENT_PRESETS[validatedParams.currentPreset]!;
    console.log("⚙️ Preset config:", presetConfig);

    // Rank strict fields by selectivity
    const orderedStrictFields = await this.selectivity.rankStrictFields(
      presetConfig.strictFields,
      validatedParams.currentContext
    );
    console.log("📋 Ordered strict fields:", orderedStrictFields);

    const flexibleFields = presetConfig.flexibleFields;
    console.log("🎯 Flexible fields:", flexibleFields);

    // Build reason-based query with 'forward' direction
    const cypher = buildReasonBasedQuery(
      orderedStrictFields,
      flexibleFields,
      'forward'
    );

    console.log("🔗 Generated Reason-Based Cypher Query:");
    console.log("─".repeat(80));
    console.log(cypher);
    console.log("─".repeat(80));

    const queryParams = {
      searchContext: validatedParams.currentContext,
      currentUserId: validatedParams.currentUserId,
      periodMonths: validatedParams.lookahead_months,
      requiredReasons: validatedParams.required_reasons,
      excludedReasons: validatedParams.excluded_reasons,
    };
    console.log("📦 Query parameters:", {
      currentUserId: queryParams.currentUserId,
      periodMonths: queryParams.periodMonths,
      requiredReasons: queryParams.requiredReasons,
      excludedReasons: queryParams.excludedReasons,
      searchContext: {
        position: queryParams.searchContext.position,
        domains: queryParams.searchContext.domains,
        skills: queryParams.searchContext.skills?.slice(0, 3),
      },
    });

    let result;
    try {
      result = await withReadSession(this.driver, (tx) =>
        tx.run(cypher, queryParams)
      );
    } catch (error) {
      console.error(
        "❌ [SearchManager.searchCurrentReasonBased] Query execution failed:",
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
          `❌ [SearchManager.searchCurrentReasonBased] Record ${index} has null reason_combination_result`
        );
        throw new Error(
          `Invalid query result: reason_combination_result is null at index ${index}`
        );
      }

      try {
        return ReasonCombinationSchema.parse(reasonCombinationResult);
      } catch (error) {
        console.error(
          `❌ [SearchManager.searchCurrentReasonBased] Failed to parse record ${index}:`,
          error
        );
        console.error("Raw data:", reasonCombinationResult);
        throw error;
      }
    });

    if (parsedResults.length === 0) {
      console.warn(
        "⚠️ [SearchManager.searchCurrentReasonBased] No reason combinations found for the given criteria"
      );
      console.warn("Debug info:", {
        lookahead_months: validatedParams.lookahead_months,
        required_reasons: validatedParams.required_reasons,
        excluded_reasons: validatedParams.excluded_reasons,
        currentContext: {
          position: validatedParams.currentContext.position,
          domains: validatedParams.currentContext.domains,
        },
      });
    }

    console.log(
      "🎯 Reason-based results:",
      parsedResults.map((r) => ({
        combination: r.combination,
        users_count: r.users_count,
        avg_duration: r.stats.avg_duration_months,
        median_duration_months: r.stats.median_duration_months,
      }))
    );

    return parsedResults;
  }

  async searchTargetOnlyMode(
    params: TargetOnlyReasonParams
  ): Promise<ReasonCombination[]> {
    // Validate all parameters including lookback_months range
    const validatedParams = TargetOnlyReasonParamsSchema.parse(params);

    console.log(
      "🎯 [SearchManager.searchTargetOnlyMode] Starting target-only search (grouped by reasons)"
    );
    console.log("📊 Input params:", {
      currentUserId: validatedParams.currentUserId,
      targetPreset: validatedParams.targetPreset,
      lookback_months: validatedParams.lookback_months,
      required_reasons: validatedParams.required_reasons,
      excluded_reasons: validatedParams.excluded_reasons,
      targetContext: {
        position: validatedParams.targetContext.position,
        domains: validatedParams.targetContext.domains,
        skills: validatedParams.targetContext.skills?.slice(0, 3),
        country_code: validatedParams.targetContext.country_code,
      },
    });

    // Validate preset (target presets)
    if (!isTargetPresetName(validatedParams.targetPreset)) {
      throw new Error(`Invalid target preset name: ${validatedParams.targetPreset}`);
    }

    const presetConfig = TARGET_PRESETS[validatedParams.targetPreset]!;
    console.log("⚙️ Preset config:", presetConfig);

    // Rank strict fields by selectivity
    const orderedStrictFields = await this.selectivity.rankStrictFields(
      presetConfig.strictFields,
      validatedParams.targetContext
    );
    console.log("📋 Ordered strict fields:", orderedStrictFields);

    const flexibleFields = presetConfig.flexibleFields;
    console.log("🎯 Flexible fields:", flexibleFields);

    // Build reason-based query with 'backward' direction
    const cypher = buildReasonBasedQuery(
      orderedStrictFields,
      flexibleFields,
      'backward'
    );

    console.log("🔗 Generated Reason-Based Cypher Query (BACKWARD):");
    console.log("─".repeat(80));
    console.log(cypher);
    console.log("─".repeat(80));

    const queryParams = {
      searchContext: validatedParams.targetContext,
      currentUserId: validatedParams.currentUserId,
      periodMonths: validatedParams.lookback_months,
      requiredReasons: validatedParams.required_reasons,
      excludedReasons: validatedParams.excluded_reasons,
    };
    console.log("📦 Query parameters:", {
      currentUserId: queryParams.currentUserId,
      periodMonths: queryParams.periodMonths,
      requiredReasons: queryParams.requiredReasons,
      excludedReasons: queryParams.excludedReasons,
      searchContext: {
        position: queryParams.searchContext.position,
        domains: queryParams.searchContext.domains,
        skills: queryParams.searchContext.skills?.slice(0, 3),
      },
    });

    let result;
    try {
      result = await withReadSession(this.driver, (tx) =>
        tx.run(cypher, queryParams)
      );
    } catch (error) {
      console.error(
        "❌ [SearchManager.searchTargetReasonBased] Query execution failed:",
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
          `❌ [SearchManager.searchTargetReasonBased] Record ${index} has null reason_combination_result`
        );
        throw new Error(
          `Invalid query result: reason_combination_result is null at index ${index}`
        );
      }

      try {
        return ReasonCombinationSchema.parse(reasonCombinationResult);
      } catch (error) {
        console.error(
          `❌ [SearchManager.searchTargetReasonBased] Failed to parse record ${index}:`,
          error
        );
        console.error("Raw data:", reasonCombinationResult);
        throw error;
      }
    });

    if (parsedResults.length === 0) {
      console.warn(
        "⚠️ [SearchManager.searchTargetReasonBased] No reason combinations found for the given criteria"
      );
      console.warn("Debug info:", {
        lookback_months: validatedParams.lookback_months,
        required_reasons: validatedParams.required_reasons,
        excluded_reasons: validatedParams.excluded_reasons,
        targetContext: {
          position: validatedParams.targetContext.position,
          domains: validatedParams.targetContext.domains,
        },
      });
    }

    console.log(
      "🎯 Reason-based results:",
      parsedResults.map((r) => ({
        combination: r.combination,
        users_count: r.users_count,
        avg_duration: r.stats.avg_duration_months,
        median_duration_months: r.stats.median_duration_months,
      }))
    );

    return parsedResults;
  }

  /**
   * GDS Similarity-Based Search (Week 2 Day 4)
   *
   * Finds similar contexts using GDS Node Similarity algorithms (Jaccard/Overlap).
   * Uses GDS for 10x-100x speedup compared to manual Jaccard in Cypher.
   *
   * @param params - Search parameters (searchContextId, algorithm, topK, cutoff, filters)
   * @returns Array of similar contexts with match scores
   */
  async searchSimilarityBased(
    params: GdsSimilaritySearchParams
  ): Promise<Array<{ context_id: string; match_score: number }>> {
    const validatedParams = GdsSimilaritySearchParamsSchema.parse(params);

    console.log("🔍 [SearchManager.searchSimilarityBased] Starting GDS similarity search");
    console.log("📊 Input params:", {
      searchContextId: validatedParams.searchContextId,
      algorithm: validatedParams.algorithm,
      topK: validatedParams.topK,
      similarityCutoff: validatedParams.similarityCutoff,
      filters: validatedParams.filters,
    });

    // Ensure GDS skills graph projection exists
    console.log("🔧 [SearchManager] Ensuring GDS skills graph projection...");
    await this.gdsProjection.ensureSkillsGraphProjection();

    // Call GDS Similarity service
    console.log(`🎯 [SearchManager] Calling GDS ${validatedParams.algorithm} similarity...`);
    const results = await this.gdsSimilarity.findSimilarBy(
      validatedParams.algorithm,
      validatedParams.searchContextId,
      validatedParams.filters,
      validatedParams.topK,
      validatedParams.similarityCutoff
    );

    console.log(`✅ [SearchManager] Found ${results.length} similar contexts`);
    console.log("📊 Top 5 results:", results.slice(0, 5).map(r => ({
      context_id: r.context_id,
      match_score: r.match_score.toFixed(3),
    })));

    return results;
  }

  /**
   * GDS Pipeline with Pathfinding (Week 2 Day 4 Part 2)
   *
   * Combines GDS Node Similarity (find similar contexts) with Yen's K-Shortest Paths.
   * Use case: Find users who reached target position AND show career paths they took.
   *
   * @param searchContextId - Starting context ID
   * @param targetPosition - Target position to reach
   * @param algorithm - Similarity algorithm (Jaccard/Overlap)
   * @param k - Number of shortest paths to find
   * @param topK - Max similar contexts to consider
   * @param similarityCutoff - Minimum similarity threshold
   * @returns Array of similar contexts with their career paths
   */
  async searchPipelineWithPathfinding(params: {
    searchContextId: string;
    targetPosition: string;
    algorithm: 'Jaccard' | 'Overlap';
    k?: number;
    topK?: number;
    similarityCutoff?: number;
  }): Promise<Array<{
    context_id: string;
    match_score: number;
    paths: PathResult[];
  }>> {
    console.log("🚀 [SearchManager.searchPipelineWithPathfinding] Starting GDS pipeline with pathfinding");
    console.log("📊 Input params:", params);

    // Step 1: Find similar contexts using GDS Node Similarity
    const similarContexts = await this.searchSimilarityBased({
      searchContextId: params.searchContextId,
      algorithm: params.algorithm,
      topK: params.topK,
      similarityCutoff: params.similarityCutoff,
      filters: { position: params.targetPosition },
    });

    console.log(`✅ Found ${similarContexts.length} similar contexts at target position`);

    // Step 2: For each similar context, find K shortest paths from search context
    const results = [];
    for (const similar of similarContexts) {
      const paths = await this.gdsPathfinding.findKShortestPaths(
        params.searchContextId,
        similar.context_id,
        params.k ?? 3
      );

      results.push({
        context_id: similar.context_id,
        match_score: similar.match_score,
        paths,
      });
    }

    console.log(`✅ Found paths for ${results.length} contexts`);
    return results;
  }

  /**
   * Find K Shortest Paths (Direct GDS wrapper)
   *
   * Week 2 Day 4 Part 2 - Direct MCP tool wrapper for GdsPathfindingService
   *
   * @param sourceContextId - Starting context ID
   * @param targetContextId - Target context ID
   * @param k - Number of shortest paths (default: 3)
   * @returns Array of paths ordered by total cost
   */
  async findKShortestPaths(
    sourceContextId: string,
    targetContextId: string,
    k?: number
  ): Promise<PathResult[]> {
    console.log("🛤️ [SearchManager.findKShortestPaths] Finding K shortest paths");
    console.log("📊 Input params:", { sourceContextId, targetContextId, k });

    const results = await this.gdsPathfinding.findKShortestPaths(
      sourceContextId,
      targetContextId,
      k ?? 3
    );

    console.log(`✅ Found ${results.length} paths`);
    return results;
  }

  /**
   * Get Duration Statistics by Reason (Week 2 Day 4 Part 2)
   *
   * Wrapper for ReasonAnalyticsService.getDurationByReason()
   *
   * @returns Duration statistics (avg, median, percentiles) per creation_reason
   */
  async getDurationByReason(): Promise<DurationByReasonResult[]> {
    console.log("📊 [SearchManager.getDurationByReason] Fetching duration statistics");
    const results = await this.reasonAnalytics.getDurationByReason();
    console.log(`✅ Found statistics for ${results.length} reasons`);
    return results;
  }

  /**
   * Get Reason Transition Matrix (Week 2 Day 4 Part 2)
   *
   * Wrapper for ReasonAnalyticsService.getReasonTransitionMatrix()
   *
   * @returns Transition probabilities: P(to_reason | current_reason)
   */
  async getReasonTransitionMatrix(): Promise<ReasonTransitionResult[]> {
    console.log("🔄 [SearchManager.getReasonTransitionMatrix] Fetching transition matrix");
    const results = await this.reasonAnalytics.getReasonTransitionMatrix();
    console.log(`✅ Found ${results.length} transition patterns`);
    return results;
  }

  /**
   * Get Reason Co-occurrence (Week 2 Day 4 Part 2)
   *
   * Wrapper for ReasonAnalyticsService.getReasonCooccurrence()
   *
   * @returns Reason pairs that appear together in same context
   */
  async getReasonCooccurrence(): Promise<ReasonCooccurrenceResult[]> {
    console.log("🔗 [SearchManager.getReasonCooccurrence] Fetching co-occurrence patterns");
    const results = await this.reasonAnalytics.getReasonCooccurrence();
    console.log(`✅ Found ${results.length} co-occurrence pairs`);
    return results;
  }
}
