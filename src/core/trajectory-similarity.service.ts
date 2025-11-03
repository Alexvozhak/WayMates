import type { UserContext, DTWMetrics } from "./schemas.js";

export class TrajectorySimilarityService {
  computeDTWMetrics(
    _userTrajectory: UserContext[],
    _candidateTrajectory: UserContext[]
  ): Promise<DTWMetrics> {
    throw new Error("Not implemented");
  }

  computeShapeSimilarity(
    _userTrajectory: UserContext[],
    _candidateTrajectory: UserContext[]
  ): Promise<number> {
    throw new Error("Not implemented");
  }

  computeTempoSimilarity(
    _userTrajectory: UserContext[],
    _candidateTrajectory: UserContext[]
  ): Promise<number> {
    throw new Error("Not implemented");
  }

  computeStabilityScore(
    _userTrajectory: UserContext[],
    _candidateTrajectory: UserContext[]
  ): Promise<number> {
    throw new Error("Not implemented");
  }
}
