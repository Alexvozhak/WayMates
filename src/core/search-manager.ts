import type { DatabaseContext } from "../database-context.js";
import type { SelectivityService } from "../services/selectivity.service.js";
import type { TrajectorySimilarityService } from "./trajectory-similarity.service.js";
import type { PathCollectorService } from "./path-collector.service.js";
import type { GoalsManager } from "./goals-manager.js";
import type {
  ContextField,
  UserSearchParams,
  TargetSearchParams,
  SearchByContextParams,
} from "./schemas.js";
import { CONTEXT_FIELD_NAMES } from "./schemas.js";
import {
  UserContextSchema,
  ScoredMatchedCandidateSchema,
  MatchedCandidateWithPathSchema,
  type UserContext,
  type ScoredMatchedCandidate,
  type MatchedCandidateWithPath,
} from "../shared/schemas.js";
import {
  buildCurrentSearchQuery,
  userCurrentContextQuery,
} from "./search-query-builder.js";
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

  async searchAdhoc(
    params: SearchByContextParams
  ): Promise<ScoredMatchedCandidate[]> {
    return this.searchByContext(params);
  }

  async searchByUser(
    params: UserSearchParams
  ): Promise<ScoredMatchedCandidate[]> {
    const context = await this.resolveContext(params.userId);
    const hasTrajectory = context.previousContextId !== null;

    if (hasTrajectory) {
      return this.executeCoreSearchWithDTW(params, context);
    } else {
      return this.searchByContext({
        userId: params.userId,
        referenceContext: context,
        filters: params.filters,
      });
    }
  }

  async searchByTarget(
    params: TargetSearchParams
  ): Promise<MatchedCandidateWithPath[]> {
    const query = buildTargetSearchWithPathsQuery(params);

    const { filters } = params;
    const { criteria, excludedCreationReasons, recencyThresholdMonths, limit } =
      filters;

    const queryParams = {
      position: criteria?.position,
      countries: criteria?.countries,
      domains: criteria?.domains,
      skills: criteria?.skills,
      excludedCreationReasons,
      recencyThresholdMonths,
      limit,
    };

    return this.db.read(async (tx) => {
      const result = await tx.run(query, queryParams);

      return result.records.map((record) =>
        MatchedCandidateWithPathSchema.parse(record.toObject())
      );
    });
  }

  private async searchByContext(
    params: SearchByContextParams
  ): Promise<ScoredMatchedCandidate[]> {
    const { referenceContext, filters, userId } = params;

    const strictFields = computeStrictFields(
      filters.excludedContextFields
    );

    const goal = await this.goalsManager.getUserGoal(userId);

    const rankedStrictFields = await this.selectivity.rankStrictFields(
      strictFields,
      referenceContext
    );

    const query = buildCurrentSearchQuery(goal, rankedStrictFields, {
      userId: userId,
      recencyThresholdMonths: filters.recencyThresholdMonths,
      limit: filters.limit,
    });

    const queryParams = {
      userId: userId,
      referenceContext: referenceContext,
      excludedCreationReasons: filters.excludedCreationReasons,
      recencyThresholdMonths: filters.recencyThresholdMonths,
      limit: filters.limit,
    };

    return this.db.read(async (tx) => {
      const result = await tx.run(query, queryParams);

      return result.records.map((record) =>
        ScoredMatchedCandidateSchema.parse(record.toObject())
      );
    });
  }

  private async resolveContext(userId: string): Promise<UserContext> {
    const query = userCurrentContextQuery();

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
    params: UserSearchParams,
    referenceContext: UserContext
  ): Promise<ScoredMatchedCandidate[]> {
    const topCandidates = await this.searchByContext({
      userId: params.userId,
      referenceContext,
      filters: params.filters,
    });

    if (topCandidates.length === 0) {
      return [];
    }

    const candidateIds = topCandidates.map((c) => c.user_id);
    const pathsMap = await this.pathCollector.collectTrajectories([
      params.userId,
      ...candidateIds,
    ]);

    const userPath = pathsMap.get(params.userId);
    if (!userPath) {
      throw new Error(`User ${params.userId} has no trajectory`);
    }

    const excludedReasons = params.filters.excludedCreationReasons;
    const candidatesWithDTW: ScoredMatchedCandidate[] = [];

    for (const candidate of topCandidates) {
      const enrichedCandidate = await this.enrichCandidateWithDTW(
        candidate,
        userPath,
        pathsMap,
        excludedReasons,
        params.userId
      );

      if (enrichedCandidate) {
        candidatesWithDTW.push(enrichedCandidate);
      }
    }

    return candidatesWithDTW
      .sort((a, b) => {
        const scoreA = (a.dtw_total || 0) + a.context_match_score;
        const scoreB = (b.dtw_total || 0) + b.context_match_score;
        return scoreB - scoreA;
      })
      .slice(0, params.pathLimit);
  }

  private async enrichCandidateWithDTW(
    candidate: ScoredMatchedCandidate,
    userPath: UserContext[],
    pathsMap: Map<string, UserContext[]>,
    excludedReasons: string[],
    userId: string
  ): Promise<ScoredMatchedCandidate | null> {
    if (candidate.user_id === userId) {
      return null;
    }

    const path = pathsMap.get(candidate.user_id);
    if (!path) {
      return null;
    }

    const hasExcluded = path.some((ctx) =>
      ctx.creationReason.some((r: string) => excludedReasons.includes(r))
    );
    if (hasExcluded) {
      return null;
    }

    const dtwMetrics = await this.trajectorySimilarity.computeDTWMetrics(
      userPath,
      path
    );

    const dtwTotal =
      dtwMetrics.shape_similarity +
      dtwMetrics.tempo_similarity +
      dtwMetrics.stability_score;

    return {
      ...candidate,
      path,
      dtw_metrics: dtwMetrics,
      dtw_total: dtwTotal,
    };
  }

}
