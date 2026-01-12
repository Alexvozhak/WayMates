import type { UserContext } from "../../../private/schemas.js";
import type { ChartableField, FieldConfig, GoalValues } from "../types.js";

/**
 * Field configurations for all chartable fields.
 * Each config defines how to extract, label, and level the field.
 */
export const FIELD_CONFIGS: Record<ChartableField, FieldConfig> = {
  position: {
    field: "position",
    labels: { ru: "Позиция", en: "Position" },
    extractValue: (ctx: UserContext) => ctx.position,
    getLevels: () => [], // dynamic from positionOrder
  },

  role: {
    field: "role",
    labels: { ru: "Роль", en: "Role" },
    extractValue: (ctx: UserContext) => ctx.role ?? null,
    getLevels: () => [], // dynamic
  },

  domains: {
    field: "domains",
    labels: { ru: "Домен", en: "Domain" },
    extractValue: (ctx: UserContext, goalValues?: GoalValues) => {
      const goalDomain = goalValues?.domains;
      if (typeof goalDomain === "string" && ctx.domains.includes(goalDomain)) {
        return goalDomain;
      }
      return ctx.domains[0] ?? null;
    },
    getLevels: () => [], // dynamic - extracted from data
  },

  countryCode: {
    field: "countryCode",
    labels: { ru: "Страна", en: "Country" },
    extractValue: (ctx: UserContext) => ctx.countryCode,
    getLevels: () => [], // dynamic
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
    extractValue: (ctx: UserContext) => {
      if (ctx.salaryExact != null) return ctx.salaryExact;
      if (ctx.salaryMin != null && ctx.salaryMax != null) {
        return Math.round((ctx.salaryMin + ctx.salaryMax) / 2);
      }
      return ctx.salaryMin ?? ctx.salaryMax ?? null;
    },
    getLevels: () => [], // numeric - no levels
  },
};

/**
 * Default fields to display on chart (all except salary).
 * User can toggle via checkboxes in HTML.
 */
export const DEFAULT_FIELDS: ChartableField[] = ["position", "role", "domains", "countryCode", "cityName", "industry"];
