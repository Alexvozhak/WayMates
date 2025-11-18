import type { DictionaryType } from "../../shared/schemas.js";

export function getVerifiedDictionariesQuery(): string {
  return `
MATCH (s:Skill {verified: true})
WITH collect(s.canonicalName) AS skills
MATCH (p:Position {verified: true})
WITH skills, collect(p.canonicalName) AS positions
MATCH (d:WorkDomain {verified: true})
WITH skills, positions, collect(d.canonicalName) AS domains
MATCH (c:City {verified: true})
WITH skills, positions, domains, collect(c.canonicalName) AS cities
MATCH (i:Industry {verified: true})
WITH skills, positions, domains, cities, collect(i.canonicalName) AS industries
MATCH (pl:Platform {verified: true})
WITH skills, positions, domains, cities, industries, collect(pl.canonicalName) AS platforms
MATCH (l:Language {verified: true})
WITH skills, positions, domains, cities, industries, platforms, collect(l.canonicalName) AS languages
RETURN {
  skills: skills,
  positions: positions,
  domains: domains,
  cities: cities,
  industries: industries,
  platforms: platforms,
  languages: languages
} AS dictionaries
  `.trim();
}

export function addTermQuery(type: DictionaryType): string {
  const label = getLabelForType(type);

  return `
MERGE (t:${label} {canonicalName: $canonicalName})
ON CREATE SET
  t.verified = $verified,
  t.createdAt = $createdAt,
  t.createdBy = $createdBy
RETURN t.canonicalName AS canonicalName
  `.trim();
}

function getLabelForType(type: DictionaryType): string {
  const labelMap: Record<DictionaryType, string> = {
    skill: "Skill",
    position: "Position",
    domain: "WorkDomain",
    city: "City",
    industry: "Industry",
    platform: "Platform",
    language: "Language",
  };

  return labelMap[type];
}
