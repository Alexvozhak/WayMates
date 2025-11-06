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
  type ScoredMatchedCandidateWithPath,
  type ScoredMatchedCandidateWithPathAndDTW,
  type MatchedCandidateWithPath,
} from "../shared/schemas.js";
import {
  buildCurrentSearchQuery,
  buildResolveContextQuery,
} from "./search-query-builder.js";
import { buildPathQuery } from "./path-query-builder.js";
import { buildTargetSearchWithPathsQuery } from "./target-query-builder.js";

function computeStrictFields(excludedFields: ContextField[]): ContextField[] {
  return CONTEXT_FIELD_NAMES.filter(
    (field): field is ContextField => !excludedFields.includes(field)
  );
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

      return result.records.map((record) =>
        MatchedCandidateWithPathSchema.parse(record.toObject())
      );
    });
  }

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

    const query = buildCurrentSearchQuery(goal, rankedStrictFields, {
      userId: params.userId,
      recencyThresholdMonths: params.filters.recencyThresholdMonths,
      limit: params.filters.limit,
    });

    const queryParams = {
      userId: params.userId,
      referenceContext: params.referenceContext,
      excludedCreationReasons: params.filters.excludedCreationReasons,
      recencyThresholdMonths: params.filters.recencyThresholdMonths,
      limit: params.filters.limit,
    };

    return this.db.read(async (tx) => {
      const result = await tx.run(query, queryParams);

      return result.records.map((record) =>
        ScoredMatchedCandidateSchema.parse(record.toObject())
      );
    });
  }

  private async resolveContext(userId: string): Promise<UserContext> {
    const { query, queryParams } = buildResolveContextQuery(userId);

    return this.db.read(async (tx) => {
      const result = await tx.run(query, queryParams);

      const record = result.records[0];
      if (!record) {
        throw new Error(`resolveContext: user ${userId} not found`);
      }

      return UserContextSchema.parse(record.get("context"));
    });
  }

  private async getCurrentContextId(userId: string): Promise<string> {
    const query = `
      MATCH (u:User {user_id: $userId})
      WHERE u.current_context_id IS NOT NULL
      RETURN u.current_context_id AS current_context_id
    `.trim();

    return this.db.read(async (tx) => {
      const result = await tx.run(query, { userId });

      const record = result.records[0];
      if (!record) {
        throw new Error(
          `getCurrentContextId: user ${userId} not found or current_context_id is null. ` +
            `Cannot compute DTW without current context.`
        );
      }

      const currentContextId = record.get("current_context_id");

      if (!currentContextId) {
        throw new Error(
          `getCurrentContextId: user ${userId} has no current_context_id. ` +
            `Cannot compute DTW without current context.`
        );
      }

      return currentContextId;
    });
  }

  private async executeCoreSearchWithDTW(
    params: PathSearchParams,
    referenceContext: UserContext
  ): Promise<ScoredMatchedCandidateWithPathAndDTW[]> {
    const topCandidates = await this.searchByContext({
      userId: params.userId,
      referenceContext,
      filters: params.filters,
    });

    if (topCandidates.length === 0) {
      return [];
    }

    const candidatesWithPaths = await this.loadCandidatePaths(
      topCandidates,
      params.filters.excludedCreationReasons
    );

    if (candidatesWithPaths.length === 0) {
      return [];
    }

    const candidatesWithDTW = await this.computeDTWScores(
      params.userId,
      candidatesWithPaths,
      params.filters.excludedCreationReasons
    );

    return candidatesWithDTW
      .sort((a, b) => {
        const scoreA = a.dtw_total + a.context_match_score;
        const scoreB = b.dtw_total + b.context_match_score;
        return scoreB - scoreA;
      })
      .slice(0, params.pathLimit);
  }

  private async loadCandidatePaths(
    candidates: ScoredMatchedCandidate[],
    excludedCreationReasons: string[]
  ): Promise<ScoredMatchedCandidateWithPath[]> {
    const query = buildPathQuery(excludedCreationReasons);

    const contextIds = candidates.map((c) => c.matched_context.context_id);

    const queryParams = {
      contextIds,
      excludedCreationReasons,
    };

    const pathsMap = await this.db.read(async (tx) => {
      const result = await tx.run(query, queryParams);

      const map = new Map<string, UserContext[]>();
      for (const rec of result.records) {
        map.set(rec.get("id"), rec.get("path"));
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
    candidates: ScoredMatchedCandidateWithPath[],
    excludedReasons: string[]
  ): Promise<ScoredMatchedCandidateWithPathAndDTW[]> {
    const currentContextId = await this.getCurrentContextId(userId);

    const userPaths = await this.pathCollector.collectTrajectories(
      [currentContextId],
      excludedReasons
    );

    if (userPaths.length === 0 || !userPaths[0]) {
      throw new Error(
        `computeDTWScores: failed to load trajectory for user ${userId} context ${currentContextId}`
      );
    }

    const userPath = userPaths[0].path;

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
          ...candidate,
          dtw_metrics: dtwMetrics,
          dtw_total: dtwTotal,
        })
      );
    }

    return candidatesWithDTW;
  }
}
