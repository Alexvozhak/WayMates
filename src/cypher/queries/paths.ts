/**
 * Trajectory collection queries
 */

import { buildContextMapProjection } from "../constants/projections.js";
import { buildWithCollect } from "../helpers/aggregation.js";
import { buildOptionalMatchRelationships } from "../helpers/relationships.js";

/**
 * Build trajectory query for batch collection (path + trails)
 *
 * Collects full trajectories + trails for multiple users in parallel.
 * Unified query for waymates and pathfinders DTW enrichment.
 *
 * Parameters:
 * - $userIds: Array of user IDs (string[])
 *
 * Returns:
 * - userId: User ID
 * - path: Array of contexts (chronologically ordered)
 * - trails: Array of trails (learning paths between contexts)
 *
 * @example
 * const query = buildTrajectoryQuery();
 * const result = await tx.run(query, { userIds: ['usr_1', 'usr_2'] });
 * result.records.forEach(record => {
 *   const userId = record.get('userId');
 *   const path = record.get('path');
 *   const trails = record.get('trails');
 * });
 */
export function buildTrajectoryQuery(): string {
  return `
UNWIND $userIds AS userId
MATCH (searchingUser:User {userId: userId})
MATCH (end:Context {contextId: searchingUser.currentContextId})
MATCH path = (end)<-[:PREVIOUS_CONTEXT*0..]-(start:Context)
WHERE start.previousContextId IS NULL

WITH userId, searchingUser, [node IN nodes(path) | node] AS pathNodes
UNWIND pathNodes AS searchingPathContext

${buildOptionalMatchRelationships("searchingPathContext")}

${buildWithCollect("searchingPathContext", ["userId", "searchingUser"])}

ORDER BY searchingPathContext.createdAt ASC

WITH userId, searchingUser, collect(${buildContextMapProjection("searchingPath")}) AS path

// Collect trails for this user
CALL {
  WITH searchingUser
  OPTIONAL MATCH (searchingUser)-[:HAS_TRAIL]->(t:Trail)
  WITH t {
    .trailId,
    .skill,
    .platform,
    .fromContextId,
    .toContextId,
    .totalDurationWeeks,
    .costUsd,
    .ratingCourse,
    .ratingPlatform,
    .ratingSchedule,
    .courseName,
    .courseLink,
    .userFeedback,
    schedule: CASE
      WHEN t.sessionsPerWeek IS NOT NULL OR t.hoursPerSession IS NOT NULL
      THEN { sessionsPerWeek: t.sessionsPerWeek, hoursPerSession: t.hoursPerSession }
      ELSE null
    END
  } AS trail
  WHERE trail.trailId IS NOT NULL
  RETURN collect(trail) AS trails
}

RETURN userId, path, trails
  `.trim();
}
