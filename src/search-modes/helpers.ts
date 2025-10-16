import type { Driver, QueryResult } from "neo4j-driver";
import type { Skill, SkillCategory } from "../schemas-zod.js";
import { DEFAULT_STRICT_SKILL_CATEGORIES } from "../schemas-zod.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function executeRead<TParams = Record<string, any>>(
  driver: Driver,
  cypherQuery: string,
  cypherParams: TParams
): Promise<QueryResult> {
  const session = driver.session();
  try {
    return await session.executeRead((tx) => tx.run(cypherQuery, cypherParams));
  } finally {
    await session.close();
  }
}
//TODO почему перестали использовать
export function getStrictSkills(
  skills: Skill[] | undefined,
  strictCategories: SkillCategory[] = DEFAULT_STRICT_SKILL_CATEGORIES
): string[] {
  if (!skills || skills.length === 0) {
    return [];
  }
  return skills
    .filter(
      (skill) =>
        skill.name &&
        skill.category &&
        strictCategories.includes(skill.category)
    )
    .map((skill) => skill.name);
}
