function buildPathEntryPoint(pathEnd: 'toMatched' | 'toTarget'): string {
  return pathEnd === 'toMatched'
    ? `
    UNWIND $contextIds AS id
    MATCH path = (c:Context {context_id: id})<-[:PREVIOUS_CONTEXT*0..]-(start:Context)
    WHERE start.previous_context_id IS NULL
    WITH id, [node IN nodes(path) | node] AS pathNodes
    `
    : `
    UNWIND $userIds AS id
    MATCH (u:User {user_id: id})
    MATCH path = (current:Context {context_id: u.current_context_id})<-[:PREVIOUS_CONTEXT*0..]-(start:Context)
    WHERE start.previous_context_id IS NULL
    WITH id, [node IN nodes(path) | node] AS pathNodes
    `;
}

/**
 * Universal query builder for career paths.
 * Supports two modes:
 * - 'toMatched': paths from contextIds (for DTW matching)
 * - 'toTarget': paths from userIds (for target-only search)
 */
export function buildPathsQuery(
  pathEnd: 'toMatched' | 'toTarget',
  excludedCreationReasons: string[]
): string {
  const hasExcludedReasons = excludedCreationReasons.length > 0;

  const entryPoint = buildPathEntryPoint(pathEnd);
  const returnKey = pathEnd === 'toMatched' ? 'contextId' : 'userId';

  return `
    ${entryPoint}

    UNWIND pathNodes AS ctx
    OPTIONAL MATCH (ctx)-[:HAS_POSITION]->(p:Position)
    OPTIONAL MATCH (ctx)-[:IN_WORK_DOMAIN]->(wd:WorkDomain)
    OPTIONAL MATCH (ctx)-[:USES_SKILL]->(s:Skill)
    OPTIONAL MATCH (ctx)-[:IN_INDUSTRY]->(i:Industry)
    OPTIONAL MATCH (ctx)-[:IN_CITY]->(ci:City)
    OPTIONAL MATCH (ctx)-[:IN_COUNTRY]->(co:Country)

    WITH id, ctx, p, wd, s, i, ci, co,
         collect(DISTINCT wd.name) AS domains,
         collect(DISTINCT s.name) AS skills
    ORDER BY ctx.created_at ASC

    WITH id, collect({
      context_id: ctx.context_id,
      position: p.name,
      domains: domains,
      skills: skills,
      industry: i.name,
      company_size: ctx.company_size,
      country_code: co.name,
      city_name: ci.name,
      work_type: ctx.work_type,
      citizenships: ctx.citizenships,
      team_size: ctx.team_size,
      birth_year: ctx.birth_year,
      creation_reason: ctx.creation_reason,
      created_at: ctx.created_at,
      previous_context_id: ctx.previous_context_id,
      next_context_id: ctx.next_context_id
    }) AS trajectory

    ${
      hasExcludedReasons
        ? `
    WHERE NOT ANY(ctx IN trajectory WHERE
      ANY(reason IN ctx.creation_reason WHERE reason IN $excludedCreationReasons))
    `
        : ""
    }

    RETURN id AS ${returnKey}, trajectory
  `.trim();
}
