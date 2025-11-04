import type { DatabaseContext } from "../database-context.js";
import type { SelectivityService } from "../services/selectivity.service.js";
import type { TrajectorySimilarityService } from "./trajectory-similarity.service.js";
import type { PathCollectorService } from "./path-collector.service.js";
import type { GoalsManager } from "./goals-manager.js";
import type {
  PendingSearchParams,
  ReadySearchParams,
  PathSearchParams,
  TargetOnlySearchParams,
} from "./schemas.js";
import {
  UserContextSchema,
  ScoredMatchedCandidateSchema,
  ScoredMatchedCandidateWithPathAndDTWSchema,
  MatchedCandidateSchema,
  type UserContext,
  type ScoredMatchedCandidate,
  type ScoredMatchedCandidateWithPathAndDTW,
  type MatchedCandidate,
  type MatchedCandidateWithPath,
  type Goal,
} from "../shared/schemas.js";
import {
  buildCurrentSearchQuery,
  buildResolveContextQuery,
  SearchQueryMode,
} from "./search-query-builder.js";
import { buildPathsQuery } from "./dtw-query-builder.js";
import { buildTargetSearchQuery } from "./target-query-builder.js";

function parseScoredMatchedCandidate(record: {
  get: (key: string) => unknown;
}): ScoredMatchedCandidate {
  const matched_context = UserContextSchema.parse(
    record.get("matched_context")
  );

  return ScoredMatchedCandidateSchema.parse({
    user_id: record.get("user_id"),
    matched_context,
    context_match_score: record.get("context_match_score"),
    candidate_type: record.get("candidate_type"),
    time_since_matched_months: record.get("time_since_matched_months"),
  });
}

export class SearchManager {
  constructor(
    private db: DatabaseContext,
    private selectivity: SelectivityService,
    private trajectorySimilarity: TrajectorySimilarityService,
    private pathCollector: PathCollectorService,
    private goalsManager: GoalsManager
  ) {}

  async searchWithContext(
    params: ReadySearchParams
  ): Promise<ScoredMatchedCandidate[]> {
    return this.executeCoreSearch(params);
  }

  async searchPendingContext(
    params: PendingSearchParams
  ): Promise<ScoredMatchedCandidate[]> {
    const ready = await this.prepareContext(params);
    return this.executeCoreSearch(ready);
  }

  async searchPath(
    params: PathSearchParams
  ): Promise<ScoredMatchedCandidateWithPathAndDTW[]> {
    const context = await this.resolveContext(params.userId);

    if (context.previous_context_id === null) {
      throw new Error(
        "searchPath requires user with path (previous_context_id !== null)"
      );
    }

    return this.executeCoreSearchWithDTW(params, context);
  }

  async searchTargetOnly(
    params: TargetOnlySearchParams
  ): Promise<MatchedCandidateWithPath[]> {
    const matchedCandidates = await this.matchTargetCandidates(params);

    if (matchedCandidates.length === 0) {
      return [];
    }

    const pathsMap = await this.loadTargetPaths(matchedCandidates, {
      excludedCreationReasons: params.filters.excludedCreationReasons,
    });

    return matchedCandidates
      .filter((c) => pathsMap.has(c.user_id))
      .map((c) => ({
        ...c,
        path: pathsMap.get(c.user_id)!,
      }));
  }

  private async matchTargetCandidates(
    params: TargetOnlySearchParams
  ): Promise<MatchedCandidate[]> {
    const {
      userId,
      targetPosition,
      targetCountries,
      targetDomains,
      targetSkills,
      filters,
    } = params;

    const searchQuery = buildTargetSearchQuery({
      userId,
      targetPosition,
      targetCountries,
      targetDomains,
      targetSkills,
      strictFields: filters.strictFields,
      recencyThresholdMonths: filters.recencyThresholdMonths,
      limit: filters.limit,
    });

    return this.db.read(async (tx) => {
      const result = await tx.run(searchQuery, {
        userId,
        targetPosition,
        targetCountries: targetCountries || [],
        targetDomains: targetDomains || [],
        targetSkills: targetSkills || [],
        recencyThresholdMonths: filters.recencyThresholdMonths,
        limit: filters.limit,
      });

      return result.records.map((rec) => {
        const rawContext = rec.get("matched_context") as Record<
          string,
          unknown
        >;
        const matched_context = UserContextSchema.parse(rawContext);

        return MatchedCandidateSchema.parse({
          user_id: rec.get("user_id"),
          matched_context,
          time_since_matched_months: rec.get("time_since_matched_months"),
        });
      });
    });
  }

  private async loadTargetPaths(
    candidates: MatchedCandidate[],
    options: { excludedCreationReasons: string[] | undefined }
  ): Promise<Map<string, UserContext[]>> {
    const pathsQuery = buildPathsQuery({
      pathEnd: 'toTarget',
      excludedCreationReasons: options.excludedCreationReasons,
    });

    const userIds = candidates.map((c) => c.user_id);

    return this.db.read(async (tx) => {
      const result = await tx.run(pathsQuery, {
        userIds,
        excludedCreationReasons: options.excludedCreationReasons || [],
      });

      const map = new Map<string, UserContext[]>();
      for (const rec of result.records) {
        map.set(rec.get("userId"), rec.get("trajectory"));
      }
      return map;
    });
  }

  private async prepareContext(
    params: PendingSearchParams
  ): Promise<ReadySearchParams> {
    const context = await this.resolveContext(params.userId);
    return {
      userId: params.userId,
      referenceContext: context,
      filters: params.filters,
    };
  }

  private async resolveContext(userId: string): Promise<UserContext> {
    const query = buildResolveContextQuery();

    return this.db.read(async (tx) => {
      const result = await tx.run(query, { userId });

      const record = result.records[0];
      if (!record) {
        throw new Error(`resolveContext: user ${userId} not found`);
      }

      return UserContextSchema.parse(record.get("context"));
    });
  }

  private async executeCoreSearch(
    params: ReadySearchParams
  ): Promise<ScoredMatchedCandidate[]> {
    const goal = await this.goalsManager.getUserGoal(params.userId);

    const rankedStrictFields = await this.selectivity.rankStrictFields(
      params.filters.strictFields,
      params.referenceContext
    );

    const query = buildCurrentSearchQuery({
      referenceContext: params.referenceContext,
      userId: params.userId,
      goal,
      strictFields: rankedStrictFields,
      excludedCreationReasons: params.filters.excludedCreationReasons,
      recencyThresholdMonths: params.filters.recencyThresholdMonths,
      limit: params.filters.limit,
      mode: SearchQueryMode.BasicRanking,
    });

    return this.db.read(async (tx) => {
      const result = await tx.run(query, {
        userId: params.userId,
        referenceContext: params.referenceContext,
        excludedCreationReasons: params.filters.excludedCreationReasons ?? [],
        recencyThresholdMonths: params.filters.recencyThresholdMonths,
        limit: params.filters.limit,
      });

      return result.records.map(parseScoredMatchedCandidate);
    });
  }

  private async executeCoreSearchWithDTW(
    params: PathSearchParams,
    referenceContext: UserContext
  ): Promise<ScoredMatchedCandidateWithPathAndDTW[]> {
    const goal = await this.goalsManager.getUserGoal(params.userId);
    const rankedStrictFields = await this.selectivity.rankStrictFields(
      params.filters.strictFields,
      referenceContext
    );

    const topCandidates = await this.preFilterCandidatesForDTW(
      params,
      referenceContext,
      goal,
      rankedStrictFields
    );

    if (topCandidates.length === 0) {
      return [];
    }

    const candidatesWithPaths = await this.loadCandidatePaths(topCandidates, {
      excludedCreationReasons: params.filters.excludedCreationReasons,
    });

    if (candidatesWithPaths.length === 0) {
      return [];
    }

    const candidatesWithDTW = await this.computeDTWScores(
      params.userId,
      candidatesWithPaths
    );

    return candidatesWithDTW
      .sort((a, b) => {
        const scoreA =
          a.dtw_total + a.context_match_score;
        const scoreB =
          b.dtw_total + b.context_match_score;
        return scoreB - scoreA;
      })
      .slice(0, params.pathLimit);
  }

  private async preFilterCandidatesForDTW(
    params: PathSearchParams,
    referenceContext: UserContext,
    goal: Goal | null,
    strictFields: string[]
  ): Promise<ScoredMatchedCandidate[]> {
    const preFilterQuery = buildCurrentSearchQuery({
      referenceContext,
      userId: params.userId,
      goal,
      strictFields,
      excludedCreationReasons: undefined,
      recencyThresholdMonths: params.filters.recencyThresholdMonths,
      limit: params.filters.limit,
      mode: SearchQueryMode.DTWPrefilter,
    });

    return this.db.read(async (tx) => {
      const result = await tx.run(preFilterQuery, {
        userId: params.userId,
        referenceContext,
        excludedCreationReasons: [],
        recencyThresholdMonths: params.filters.recencyThresholdMonths,
        limit: params.filters.limit,
      });

      return result.records.map(parseScoredMatchedCandidate);
    });
  }

  private async loadCandidatePaths(
    candidates: ScoredMatchedCandidate[],
    options: { excludedCreationReasons: string[] | undefined }
  ) {
    const pathsQuery = buildPathsQuery({
      pathEnd: 'toMatched',
      excludedCreationReasons: options.excludedCreationReasons,
    });

    const contextIds = candidates.map((c) => c.matched_context.context_id);

    const pathsMap = await this.db.read(async (tx) => {
      const result = await tx.run(pathsQuery, {
        contextIds,
        excludedCreationReasons: options.excludedCreationReasons || [],
      });

      const map = new Map<string, UserContext[]>();
      for (const rec of result.records) {
        map.set(rec.get("contextId"), rec.get("trajectory"));
      }
      return map;
    });

    return candidates
      .filter((c) => pathsMap.has(c.matched_context.context_id))
      .map((c) => ({
        ...c,
        path: pathsMap.get(c.matched_context.context_id)!,
      }));
  }

  private async computeDTWScores(
    userId: string,
    candidates: Array<ScoredMatchedCandidate & { path: UserContext[] }>
  ): Promise<ScoredMatchedCandidateWithPathAndDTW[]> {
    const userPath = await this.pathCollector.collectUserTrajectory(userId);

    const candidatesWithDTW: ScoredMatchedCandidateWithPathAndDTW[] = [];

    for (const candidate of candidates) {
      const dtwMetrics = await this.trajectorySimilarity.computeDTWMetrics(
        userPath,
        candidate.path
      );

      const dtwTotal =
        dtwMetrics.shape_similarity +
        dtwMetrics.tempo_similarity +
        dtwMetrics.stability_score;

      candidatesWithDTW.push(
        ScoredMatchedCandidateWithPathAndDTWSchema.parse({
          user_id: candidate.user_id,
          matched_context: candidate.matched_context,
          time_since_matched_months: candidate.time_since_matched_months,
          path: candidate.path,
          context_match_score: candidate.context_match_score,
          candidate_type: candidate.candidate_type,
          dtw_metrics: dtwMetrics,
          dtw_total: dtwTotal,
        })
      );
    }

    return candidatesWithDTW;
  }
}
