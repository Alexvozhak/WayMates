import type { SimpleDictionaryType } from "../../shared/schemas.js";

export function getVerifiedDictionariesQuery(): string {
  return `
OPTIONAL MATCH (s:Skill {verified: true})
WITH [x IN collect({canonicalName: s.canonicalName, description: coalesce(s.description, s.canonicalName)}) WHERE x.canonicalName IS NOT NULL] AS skills
OPTIONAL MATCH (p:Position {verified: true})
WITH skills, [x IN collect({canonicalName: p.canonicalName, description: coalesce(p.description, p.canonicalName)}) WHERE x.canonicalName IS NOT NULL] AS positions
OPTIONAL MATCH (r:Role {verified: true})
WITH skills, positions, [x IN collect({canonicalName: r.canonicalName, description: coalesce(r.description, r.canonicalName)}) WHERE x.canonicalName IS NOT NULL] AS roles
OPTIONAL MATCH (d:WorkDomain {verified: true})
WITH skills, positions, roles, [x IN collect({canonicalName: d.canonicalName, description: coalesce(d.description, d.canonicalName)}) WHERE x.canonicalName IS NOT NULL] AS domains
OPTIONAL MATCH (c:City {verified: true})
WITH skills, positions, roles, domains, [x IN collect({canonicalName: c.canonicalName, description: coalesce(c.description, c.canonicalName)}) WHERE x.canonicalName IS NOT NULL] AS cities
OPTIONAL MATCH (i:Industry {verified: true})
WITH skills, positions, roles, domains, cities, [x IN collect({canonicalName: i.canonicalName, description: coalesce(i.description, i.canonicalName)}) WHERE x.canonicalName IS NOT NULL] AS industries
OPTIONAL MATCH (pl:Platform {verified: true})
WITH skills, positions, roles, domains, cities, industries, [x IN collect({canonicalName: pl.canonicalName, description: coalesce(pl.description, pl.canonicalName)}) WHERE x.canonicalName IS NOT NULL] AS platforms
OPTIONAL MATCH (l:Language {verified: true})
WITH skills, positions, roles, domains, cities, industries, platforms, [x IN collect({canonicalName: l.canonicalName, description: coalesce(l.description, l.canonicalName)}) WHERE x.canonicalName IS NOT NULL] AS languages
OPTIONAL MATCH (rs:Reason)
WITH skills, positions, roles, domains, cities, industries, platforms, languages,
     [x IN collect({canonicalName: rs.canonicalName, description: coalesce(rs.description, rs.canonicalName)}) WHERE x.canonicalName IS NOT NULL] AS reasons
RETURN {
  skill: skills,
  position: positions,
  role: roles,
  domain: domains,
  city: cities,
  industry: industries,
  platform: platforms,
  language: languages,
  reasons: reasons
} AS dictionaries
  `.trim();
}

export function addSimpleTermQuery(type: SimpleDictionaryType): string {
  const label = getLabelForSimpleType(type);

  return `
MERGE (t:${label} {canonicalName: $canonicalName})
ON CREATE SET
  t.verified = $verified,
  t.createdAt = $createdAt,
  t.createdBy = $createdBy
RETURN t.canonicalName AS canonicalName
  `.trim();
}

export function addSkillQuery(): string {
  return `
MERGE (t:Skill {canonicalName: $canonicalName})
ON CREATE SET
  t.verified = $verified,
  t.createdAt = $createdAt,
  t.createdBy = $createdBy,
  t.complexity = $complexity
RETURN t.canonicalName AS canonicalName
  `.trim();
}

function getLabelForSimpleType(type: SimpleDictionaryType): string {
  const labelMap: Record<SimpleDictionaryType, string> = {
    position: "Position",
    role: "Role",
    domain: "WorkDomain",
    city: "City",
    industry: "Industry",
    platform: "Platform",
    language: "Language",
    skill: "Skill",
  };

  return labelMap[type];
}
