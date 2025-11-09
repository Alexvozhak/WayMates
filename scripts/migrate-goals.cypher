// Migration script: Goal structure refactoring
// From: { target_positions: {included, excluded}, ... }
// To:   { desired: {positions, ...}, undesired: {positions, ...} }
//
// Usage:
//   Test DB:  scripts/db.sh test -f scripts/migrate-goals.cypher
//   Prod DB:  scripts/db.sh prod -f scripts/migrate-goals.cypher

MATCH (u:User)-[:HAS_GOAL]->(g:Goal)

// Check if old structure exists
WHERE g.target_positions IS NOT NULL
   OR g.target_countries IS NOT NULL
   OR g.target_domains IS NOT NULL
   OR g.target_skills IS NOT NULL

// Transform old structure to new
WITH u, g,
  // Build desired from included arrays
  {
    positions: coalesce(g.target_positions.included, []),
    countries: coalesce(g.target_countries.included, []),
    domains: coalesce(g.target_domains.included, []),
    skills: coalesce(g.target_skills.included, [])
  } AS newDesired,

  // Build undesired from excluded arrays
  {
    positions: coalesce(g.target_positions.excluded, []),
    countries: coalesce(g.target_countries.excluded, []),
    domains: coalesce(g.target_domains.excluded, []),
    skills: coalesce(g.target_skills.excluded, [])
  } AS newUndesired

// Update Goal node with new structure
SET g.desired = newDesired,
    g.undesired = newUndesired

// Remove old properties
REMOVE g.target_positions,
       g.target_countries,
       g.target_domains,
       g.target_skills

RETURN count(g) AS migrated_goals,
       collect(u.user_id)[0..5] AS sample_user_ids;
