import type { Skill, SkillCategory } from "../schemas-zod.js";
import { DEFAULT_STRICT_SKILL_CATEGORIES } from "../schemas-zod.js";

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
