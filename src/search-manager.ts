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
} from "./schemas-zod.js";
import { ReasonCombinationSchema, CurrentOnlyReasonParamsSchema, TargetOnlyReasonParamsSchema } from "./schemas-zod.js";
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

export class SearchManager {
  constructor(
    private driver: Driver,
    private builder: SearchQueryBuilder,
    private selectivity: SelectivityService
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

  async searchCurrentReasonBased(
    params: CurrentOnlyReasonParams
  ): Promise<ReasonCombination[]> {
    // Validate all parameters including lookahead_months range
    const validatedParams = CurrentOnlyReasonParamsSchema.parse(params);

    console.log(
      "🎯 [SearchManager.searchCurrentReasonBased] Starting reason-based current-only search"
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

    // New parameter naming: searchContext, periodMonths
    const queryParams = {
      searchContext: validatedParams.currentContext,
      currentUserId: validatedParams.currentUserId,
      periodMonths: validatedParams.lookahead_months,
      requiredReasons: validatedParams.required_reasons ?? [],
      excludedReasons: validatedParams.excluded_reasons ?? [],
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

  async searchTargetReasonBased(
    params: TargetOnlyReasonParams
  ): Promise<ReasonCombination[]> {
    // Validate all parameters including lookback_months range
    const validatedParams = TargetOnlyReasonParamsSchema.parse(params);

    console.log(
      "🎯 [SearchManager.searchTargetReasonBased] Starting reason-based target-only search"
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

    // New parameter naming: searchContext, periodMonths
    const queryParams = {
      searchContext: validatedParams.targetContext,
      currentUserId: validatedParams.currentUserId,
      periodMonths: validatedParams.lookback_months,
      requiredReasons: validatedParams.required_reasons ?? [],
      excludedReasons: validatedParams.excluded_reasons ?? [],
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
}
