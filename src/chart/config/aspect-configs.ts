import type { UserContext } from "../../shared/schemas.js";
import type { AspectConfig, ChartableField } from "../types.js";

/**
 * Extract seniority grade from position title.
 * Maps position strings to standardized grade levels.
 *
 * @param position - Job title
 * @returns Grade level or "middle" (default)
 */
function extractGrade(position: string): string {
  const lower = position.toLowerCase();

  const leadKeywords = ["lead", "principal", "staff"];
  if (leadKeywords.some((keyword) => lower.includes(keyword))) {
    return "lead";
  }

  const seniorKeywords = ["senior", "sr"];
  if (seniorKeywords.some((keyword) => lower.includes(keyword))) {
    return "senior";
  }

  const middleKeywords = ["middle", "mid"];
  if (middleKeywords.some((keyword) => lower.includes(keyword))) {
    return "middle";
  }

  const juniorKeywords = ["junior", "jr"];
  if (juniorKeywords.some((keyword) => lower.includes(keyword))) {
    return "junior";
  }

  return "middle";
}

/**
 * Aspect configurations for all chartable fields.
 * Each config defines how to extract, label, and level the field.
 */
export const ASPECT_CONFIGS: Record<ChartableField, AspectConfig> = {
  position: {
    field: "position",
    labels: { ru: "Грейд", en: "Grade" },
    extractValue: (ctx: UserContext) => extractGrade(ctx.position),
    getLevels: () => ["junior", "middle", "senior", "lead"],
  },

  domains: {
    field: "domains",
    labels: { ru: "Домен", en: "Domain" },
    extractValue: (ctx: UserContext) => ctx.domains[0] ?? null,
    getLevels: () => [], // dynamic - extracted from data
  },

  cityName: {
    field: "cityName",
    labels: { ru: "Город", en: "City" },
    extractValue: (ctx: UserContext) => ctx.cityName,
    getLevels: () => [], // dynamic
  },

  industry: {
    field: "industry",
    labels: { ru: "Индустрия", en: "Industry" },
    extractValue: (ctx: UserContext) => ctx.industry,
    getLevels: () => [], // dynamic
  },

  salaryExact: {
    field: "salaryExact",
    labels: { ru: "Зарплата", en: "Salary" },
    extractValue: (ctx: UserContext) => ctx.salaryExact ?? null,
    getLevels: () => [], // numeric - no levels
  },
};

/**
 * Default fields to display on chart (all except salary).
 * User can toggle via checkboxes in HTML.
 */
export const DEFAULT_FIELDS: ChartableField[] = ["position", "domains", "cityName", "industry"];
