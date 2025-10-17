import type { Driver } from "neo4j-driver";
import { SearchQueryBuilder } from "./orcestrator/search-query-builder.js";
import type {
  UserContext,
  TargetContext,
  SearchResult,
  SearchConstraints,
  CurrentOnlyResult,
  CurrentOnlyParams,
} from "./schemas-zod.js";
import { CurrentOnlyResultSchema } from "./schemas-zod.js";
import { SearchResultSchema } from "./schemas-zod.js";
import { withReadSession } from "./neo4j.js";
import { SelectivityService } from "./services/selectivity.service.js";
import { isPresetName, PRESETS } from "./orcestrator/presets.js";

export class SearchManager {
  constructor(
    private driver: Driver,
    private builder: SearchQueryBuilder,
    private selectivity: SelectivityService
  ) {}

  async searchCurrentContext(
    currentPreset: string,
    currentContext: UserContext,
    currentUserId: string,
    searchConstraints: SearchConstraints
  ): Promise<SearchResult[]> {
    console.log(
      "🔍 [SearchManager.searchCurrentContext] Starting current context search"
    );
    console.log("📊 Input params:", {
      currentPreset,
      currentUserId,
      currentContext: {
        context_id: currentContext.context_id,
        position: currentContext.position,
        domains: currentContext.domains,
        skills: currentContext.skills?.slice(0, 3),
        country_code: currentContext.country_code,
        city_name: currentContext.city_name,
      },
      searchConstraints,
    });

    if (!isPresetName(currentPreset)) {
      throw new Error(`Invalid preset name: ${currentPreset}`);
    }

    const presetConfig = PRESETS[currentPreset]!;
    if (
      !presetConfig.strictFields?.length ||
      !presetConfig.flexibleFields?.length
    ) {
      throw new Error("Preset must contain required fields");
    }
    console.log("⚙️ Preset config:", presetConfig);

    const orderedStrictFields = await this.selectivity.rankStrictFields(
      presetConfig.strictFields,
      currentContext
    );
    console.log("📋 Ordered strict fields:", orderedStrictFields);

    const flexibleFields = presetConfig.flexibleFields;
    console.log("🎯 Flexible fields:", flexibleFields);

    const cypher = this.builder.constructCurrentContextQuery(
      orderedStrictFields,
      flexibleFields,
      searchConstraints
    );

    console.log("🔗 Generated Cypher Query:");
    console.log("─".repeat(80));
    console.log(cypher);
    console.log("─".repeat(80));

    const params = { currentContext, me: currentUserId };
    console.log("📦 Query parameters:", {
      me: params.me,
      currentContext: {
        context_id: params.currentContext.context_id,
        position: params.currentContext.position,
        domains: params.currentContext.domains,
        skills: params.currentContext.skills?.slice(0, 3),
        country_code: params.currentContext.country_code,
      },
    });

    const result = await withReadSession(this.driver, (tx) =>
      tx.run(cypher, params)
    );

    console.log("✅ Query executed, records count:", result.records.length);

    const parsedResults = result.records.map((rec) =>
      SearchResultSchema.parse(rec.get("result"))
    );

    console.log(
      "🎯 Final results:",
      parsedResults.map((r) => ({
        userId: r.userId,
        currentScore: r.currentScore,
        targetScore: r.targetScore,
      }))
    );

    return parsedResults;
  }

  async searchTargetContext(
    targetPreset: string,
    targetContext: TargetContext,
    currentUserId: string,
    searchConstraints: SearchConstraints
  ): Promise<SearchResult[]> {
    console.log(
      "🎯 [SearchManager.searchTargetContext] Starting target context search"
    );
    console.log("📊 Input params:", {
      targetPreset,
      currentUserId,
      targetContext: {
        context_id: targetContext.context_id,
        position: targetContext.position,
        domains: targetContext.domains,
        skills: targetContext.skills?.slice(0, 3),
        country_code: targetContext.country_code,
        city_name: targetContext.city_name,
      },
      searchConstraints,
    });

    if (!isPresetName(targetPreset)) {
      throw new Error(`Invalid preset name: ${targetPreset}`);
    }

    const presetConfig = PRESETS[targetPreset]!;
    if (
      !presetConfig.strictFields?.length ||
      !presetConfig.flexibleFields?.length
    ) {
      throw new Error("Preset must contain required fields");
    }
    console.log("⚙️ Preset config:", presetConfig);

    const { strictFields, flexibleFields } = presetConfig;
    const orderedStrictFields = await this.selectivity.rankStrictFields(
      strictFields,
      targetContext
    );
    console.log("📋 Ordered strict fields:", orderedStrictFields);
    console.log("🎯 Flexible fields:", flexibleFields);

    const cypher = this.builder.constructTargetContextQuery(
      orderedStrictFields,
      flexibleFields,
      searchConstraints
    );

    console.log("🔗 Generated Cypher Query:");
    console.log("─".repeat(80));
    console.log(cypher);
    console.log("─".repeat(80));

    const params = { targetContext: targetContext, me: currentUserId };
    console.log("📦 Query parameters:", {
      me: params.me,
      targetContext: {
        context_id: params.targetContext.context_id,
        position: params.targetContext.position,
        domains: params.targetContext.domains,
        skills: params.targetContext.skills?.slice(0, 3),
        country_code: params.targetContext.country_code,
      },
    });

    const result = await withReadSession(this.driver, (tx) =>
      tx.run(cypher, params)
    );

    console.log("✅ Query executed, records count:", result.records.length);

    const parsedResults = result.records.map((rec) =>
      SearchResultSchema.parse(rec.get("result"))
    );

    console.log(
      "🎯 Final results:",
      parsedResults.map((r) => ({
        userId: r.userId,
        currentScore: r.currentScore,
        targetScore: r.targetScore,
      }))
    );

    return parsedResults;
  }

  async searchPipeline(
    currentPreset: string,
    currentContext: UserContext,
    targetPreset: string,
    targetContext: TargetContext,
    currentUserId: string,
    searchConstraints: SearchConstraints
  ): Promise<SearchResult[]> {
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

    if (!isPresetName(currentPreset)) {
      throw new Error(`Invalid preset name: ${currentPreset}`);
    }
    if (!isPresetName(targetPreset)) {
      throw new Error(`Invalid preset name: ${targetPreset}`);
    }

    const currentPresetConfig = PRESETS[currentPreset]!;
    const targetPresetConfig = PRESETS[targetPreset]!;
    if (
      !currentPresetConfig.strictFields?.length ||
      !currentPresetConfig.flexibleFields?.length
    ) {
      throw new Error("Preset must contain required fields");
    }
    if (
      !targetPresetConfig.strictFields?.length ||
      !targetPresetConfig.flexibleFields?.length
    ) {
      throw new Error("Preset must contain required fields");
    }
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

    const parsedResults = result.records.map((rec) =>
      SearchResultSchema.parse({
        userId: rec.get("userId"),
        currentContext: rec.get("currentContext"),
        currentScore: rec.get("currentScore"),
        targetContext: rec.get("targetContext"),
        targetScore: rec.get("targetScore"),
      })
    );

    console.log(
      "🎯 Pipeline results:",
      parsedResults.map((r) => ({
        userId: r.userId,
        currentScore: r.currentScore,
        targetScore: r.targetScore,
      }))
    );

    return parsedResults;
  }

  async searchInCurrentOnlyMode(
    params: CurrentOnlyParams
  ): Promise<CurrentOnlyResult[]> {
    console.log(
      "⏰ [SearchManager.searchInCurrentOnlyMode] Starting current-only mode search"
    );
    console.log("📊 Input params:", {
      currentUserId: params.currentUserId,
      currentPreset: params.currentPreset,
      stepSizeMonths: params.stepSizeMonths,
      numberOfSteps: params.numberOfSteps,
      includeFinalBatch: params.includeFinalBatch,
      reasonsToTrack: params.reasonsToTrack,
      currentContext: {
        context_id: params.currentContext.context_id,
        position: params.currentContext.position,
        domains: params.currentContext.domains,
        skills: params.currentContext.skills?.slice(0, 3),
        country_code: params.currentContext.country_code,
      },
      searchConstraints: params.searchConstraints,
    });

    const cypher = this.builder.buildCurrentBatchesQuery(params);

    console.log("🔗 Generated Current-Only Cypher Query:");
    console.log("─".repeat(80));
    console.log(cypher);
    console.log("─".repeat(80));

    const queryParams = {
      currentContext: params.currentContext,
      me: params.currentUserId,
      reasonsToTrack: params.reasonsToTrack,
    };
    console.log("📦 Query parameters:", {
      me: queryParams.me,
      reasonsToTrack: queryParams.reasonsToTrack,
      currentContext: {
        context_id: queryParams.currentContext.context_id,
        position: queryParams.currentContext.position,
        domains: queryParams.currentContext.domains,
        skills: queryParams.currentContext.skills?.slice(0, 3),
      },
    });

    const result = await withReadSession(this.driver, (tx) =>
      tx.run(cypher, queryParams)
    );

    console.log(
      "✅ Current-only query executed, records count:",
      result.records.length
    );

    const parsedResults = result.records.map((rec) => {
      const period = rec.get("period");
      return CurrentOnlyResultSchema.parse({
        period: period,
        results: rec.get("results"),
      });
    });

    console.log(
      "🎯 Current-only results:",
      parsedResults.map((r) => ({
        userId: r.userId,
        currentLikeContextId: r.currentLikeContextId,
        compatibilityPercent: r.compatibilityPercent,
        transitionContextId: r.transitionContextId,
        contextTriggers: r.contextTriggers,
      }))
    );

    return parsedResults;
  }
}
