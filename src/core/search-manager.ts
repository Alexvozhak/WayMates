import type { DatabaseContext } from "../database-context.js";
import type { SelectivityService } from "../services/selectivity.service.js";
import type { TrajectorySimilarityService } from "./trajectory-similarity.service.js";
import type { PathCollectorService } from "./path-collector.service.js";
import type { GoalsManager } from "./goals-manager.js";
import type {
  ContextSearchParams,
  CurrentContextSearchParams,
  PathSearchParams,
  TargetOnlySearchParams,
  ContextField,
} from "./schemas.js";
import { CONTEXT_FIELD_NAMES } from "./schemas.js";
import {
  UserContextSchema,
  ScoredMatchedCandidateSchema,
  ScoredMatchedCandidateWithPathAndDTWSchema,
  MatchedCandidateWithPathSchema,
  type UserContext,
  type ScoredMatchedCandidate,
  type ScoredMatchedCandidateWithPathAndDTW,
  type MatchedCandidateWithPath,
} from "../shared/schemas.js";
import {
  buildCurrentSearchQuery,
  buildResolveContextQuery,
} from "./search-query-builder.js";
import { buildPathsQuery } from "./dtw-query-builder.js";
import { buildTargetSearchWithPathsQuery } from "./target-query-builder.js";

function computeStrictFields(excludedFields: ContextField[]): ContextField[] {
  return CONTEXT_FIELD_NAMES.filter(
    (field): field is ContextField => !excludedFields.includes(field)
  );
}

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

function parseMatchedCandidateWithPath(record: {
  get: (key: string) => unknown;
}): MatchedCandidateWithPath {
  const matched_context = UserContextSchema.parse(
    record.get("matched_context")
  );
  const path = record.get("trajectory") as UserContext[];

  return MatchedCandidateWithPathSchema.parse({
    user_id: record.get("user_id"),
    matched_context,
    time_since_matched_months: record.get("time_since_matched_months"),
    path,
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

  async searchByCurrentContext(
    params: ContextSearchParams
  ): Promise<ScoredMatchedCandidate[]> {
    const referenceContext = await this.resolveContext(params.userId);
    return this.searchByContext({
      ...params,
      referenceContext,
    });
  }

  async searchByCurrentContextAdhoc(
    params: CurrentContextSearchParams
  ): Promise<ScoredMatchedCandidate[]> {
    return this.searchByContext(params);
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

  async searchCandidatesByTargetContext(
    params: TargetOnlySearchParams
  ): Promise<MatchedCandidateWithPath[]> {
    const { query, queryParams } = buildTargetSearchWithPathsQuery(params);

    return this.db.read(async (tx) => {
      const result = await tx.run(query, queryParams);

      return result.records.map(parseMatchedCandidateWithPath);
    });
  }

  /**
   * Core search method - used by all search modes (1, 2, 3)
   * Performs: computeStrictFields → getUserGoal → rankStrictFields → buildQuery → db.read
   *
   * NOTE: This is the DRY implementation - 95% logic reuse
   */
  private async searchByContext(
    params: CurrentContextSearchParams
  ): Promise<ScoredMatchedCandidate[]> {
    const strictFields = computeStrictFields(
      params.filters.excludedContextFields
    );

    const goal = await this.goalsManager.getUserGoal(params.userId);

    const rankedStrictFields = await this.selectivity.rankStrictFields(
      strictFields,
      params.referenceContext
    );

    const query = buildCurrentSearchQuery({
      referenceContext: params.referenceContext,
      userId: params.userId,
      goal,
      strictFields: rankedStrictFields,
      recencyThresholdMonths: params.filters.recencyThresholdMonths,
      limit: params.filters.limit,
    });

    return this.db.read(async (tx) => {
      const result = await tx.run(query, {
        userId: params.userId,
        referenceContext: params.referenceContext,
        excludedCreationReasons: params.filters.excludedCreationReasons,
        recencyThresholdMonths: params.filters.recencyThresholdMonths,
        limit: params.filters.limit,
      });

      return result.records.map(parseScoredMatchedCandidate);
    });
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

  private async executeCoreSearchWithDTW(
    params: PathSearchParams,
    referenceContext: UserContext
  ): Promise<ScoredMatchedCandidateWithPathAndDTW[]> {
    const topCandidates = await this.preFilterCandidatesForDTW(
      params,
      referenceContext
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
        const scoreA = a.dtw_total + a.context_match_score;
        const scoreB = b.dtw_total + b.context_match_score;
        return scoreB - scoreA;
      })
      .slice(0, params.pathLimit);
  }

  private async preFilterCandidatesForDTW(
    params: PathSearchParams,
    referenceContext: UserContext
  ): Promise<ScoredMatchedCandidate[]> {
    // Reuse searchByContext for pre-filtering
    return this.searchByContext({
      userId: params.userId,
      referenceContext,
      filters: params.filters,
    });
  }

  private async loadCandidatePaths(
    candidates: ScoredMatchedCandidate[],
    options: { excludedCreationReasons: string[] | undefined }
  ) {
    const pathsQuery = buildPathsQuery({
      pathEnd: "toMatched",
      excludedCreationReasons: options.excludedCreationReasons,
    });

    const contextIds = candidates.map((c) => c.matched_context.context_id);

    const pathsMap = await this.db.read(async (tx) => {
      const result = await tx.run(pathsQuery, {
        contextIds,
        excludedCreationReasons: options.excludedCreationReasons,
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
