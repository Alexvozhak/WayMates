/**
 * Reference fixtures for Chart demonstration.
 * Shows all Chart features: Overlap, Goal Stars, DTW Radar contrast.
 */

import type { ScoredMatchedCandidate, UserContext } from "../src/shared/schemas.js";

const userId = "usr_chart_demo_user";

// Helper to create context
function ctx(
  id: string,
  userId: string,
  position: string,
  domains: string[],
  cityName: string,
  industry: string,
  createdAt: string,
  role: string = "developer",
): UserContext {
  return {
    contextId: id,
    userId,
    position,
    domains,
    cityName,
    industry,
    role,
    createdAt,
    skills: [],
    countryName: "Germany",
    companySize: "medium",
    creationReason: "career_update",
  } as UserContext;
}

// ═══════════════════════════════════════════════════════════════════
// USER: Middle Frontend in Berlin, Goal = Lead Frontend
// 4 contexts: Junior → Middle → Middle (fintech) → Senior
// ═══════════════════════════════════════════════════════════════════
export const userTrajectory: UserContext[] = [
  ctx("ctx_user_1", userId, "Junior Frontend Developer", ["frontend"], "Berlin", "tech", "2020-01-15", "developer"),
  ctx("ctx_user_2", userId, "Middle Frontend Developer", ["frontend"], "Berlin", "tech", "2021-06-01", "developer"),
  ctx("ctx_user_3", userId, "Middle Frontend Developer", ["frontend"], "Berlin", "fintech", "2023-01-15", "developer"),
  ctx("ctx_user_4", userId, "Senior Frontend Developer", ["frontend"], "Berlin", "fintech", "2024-06-01", "developer"),
];

// ═══════════════════════════════════════════════════════════════════
// PATHFINDER#1: High overlap (12 months), reached goal 12 months ago
// Berlin + tech = overlaps with User in 2020-2021
// High DTW (~85%) - very similar trajectory
// ═══════════════════════════════════════════════════════════════════
const p1Id = "usr_pathfinder_1";
const pathfinder1Path: UserContext[] = [
  ctx("ctx_p1_1", p1Id, "Junior Frontend Developer", ["frontend"], "Berlin", "tech", "2019-01-10", "developer"),
  ctx("ctx_p1_2", p1Id, "Middle Frontend Developer", ["frontend"], "Berlin", "tech", "2020-06-01", "developer"),
  ctx("ctx_p1_3", p1Id, "Senior Frontend Developer", ["frontend"], "Berlin", "tech", "2022-01-15", "developer"),
  ctx("ctx_p1_4", p1Id, "Lead Frontend Developer", ["frontend"], "Berlin", "tech", "2024-01-10", "developer"),
];

// ═══════════════════════════════════════════════════════════════════
// PATHFINDER#2: Low overlap (3 months), reached goal 3 months ago
// London → Amsterdam, Fullstack → Frontend = different path
// Low DTW (~45%)
// ═══════════════════════════════════════════════════════════════════
const p2Id = "usr_pathfinder_2";
const pathfinder2Path: UserContext[] = [
  ctx("ctx_p2_1", p2Id, "Junior Fullstack Developer", ["fullstack"], "London", "fintech", "2018-01-15", "developer"),
  ctx("ctx_p2_2", p2Id, "Middle Fullstack Developer", ["fullstack"], "London", "fintech", "2019-06-01", "developer"),
  ctx("ctx_p2_3", p2Id, "Senior Frontend Developer", ["frontend"], "Amsterdam", "fintech", "2022-01-10", "developer"),
  ctx("ctx_p2_4", p2Id, "Lead Frontend Developer", ["frontend"], "Amsterdam", "fintech", "2024-09-15", "developer"),
];

// ═══════════════════════════════════════════════════════════════════
// WAYMATE#1: High overlap (15 months), same goal, not reached yet
// Berlin + tech = overlaps with User
// High DTW (~80%)
// ═══════════════════════════════════════════════════════════════════
const w1Id = "usr_waymate_1";
const waymate1Path: UserContext[] = [
  ctx("ctx_w1_1", w1Id, "Junior Frontend Developer", ["frontend"], "Berlin", "tech", "2020-03-01", "developer"),
  ctx("ctx_w1_2", w1Id, "Middle Frontend Developer", ["frontend"], "Berlin", "tech", "2021-09-15", "developer"),
  ctx("ctx_w1_3", w1Id, "Senior Frontend Developer", ["frontend"], "Berlin", "fintech", "2023-06-01", "developer"),
];

// ═══════════════════════════════════════════════════════════════════
// WAYMATE#2: Low overlap (~2 weeks), same goal, not reached yet
// Amsterdam → London, Backend → Frontend = very different path
// Low DTW (~40%)
// ═══════════════════════════════════════════════════════════════════
const w2Id = "usr_waymate_2";
const waymate2Path: UserContext[] = [
  ctx("ctx_w2_1", w2Id, "Junior Backend Developer", ["backend"], "Amsterdam", "e-commerce", "2021-01-10", "developer"),
  ctx("ctx_w2_2", w2Id, "Middle Backend Developer", ["backend"], "Amsterdam", "e-commerce", "2022-06-15", "developer"),
  ctx("ctx_w2_3", w2Id, "Middle Frontend Developer", ["frontend"], "London", "fintech", "2024-01-10", "developer"),
];

// ═══════════════════════════════════════════════════════════════════
// CANDIDATES with DTW metrics
// ═══════════════════════════════════════════════════════════════════
export const candidates: ScoredMatchedCandidate[] = [
  {
    userId: p1Id,
    matchedContext: pathfinder1Path[3]!, // Lead position
    candidateType: "pathfinder",
    timeSinceMatchedMonths: 12,
    path: pathfinder1Path,
    dtwMetrics: {
      shapeSimilarity: 0.87,
      tempoSimilarity: 0.83,
      stabilityScore: 0.85,
    },
  },
  {
    userId: p2Id,
    matchedContext: pathfinder2Path[3]!, // Lead position
    candidateType: "pathfinder",
    timeSinceMatchedMonths: 3,
    path: pathfinder2Path,
    dtwMetrics: {
      shapeSimilarity: 0.48,
      tempoSimilarity: 0.42,
      stabilityScore: 0.45,
    },
  },
  {
    userId: w1Id,
    matchedContext: waymate1Path[2]!, // Senior (current)
    candidateType: "waymate",
    timeSinceMatchedMonths: 0,
    path: waymate1Path,
    dtwMetrics: {
      shapeSimilarity: 0.82,
      tempoSimilarity: 0.78,
      stabilityScore: 0.8,
    },
  },
  {
    userId: w2Id,
    matchedContext: waymate2Path[2]!, // Middle Frontend (current)
    candidateType: "waymate",
    timeSinceMatchedMonths: 0,
    path: waymate2Path,
    dtwMetrics: {
      shapeSimilarity: 0.42,
      tempoSimilarity: 0.38,
      stabilityScore: 0.4,
    },
  },
];

// ═══════════════════════════════════════════════════════════════════
// GOAL VALUES (for horizontal goal lines)
// ═══════════════════════════════════════════════════════════════════
export const goalValues = {
  position: "lead", // extractGrade("Lead Frontend Developer") → "lead"
  domains: "frontend",
};
