import type { Locale } from "../types.js";

/**
 * Centralized labels for chart localization.
 * Supports ru/en locales.
 */
export const LABELS = {
  ru: {
    // Candidate types
    pathfinder: "Проводник",
    waymate: "Однопутник",

    // Trajectory segments
    pathToGoal: "до цели",
    afterGoal: "после",
    you: "Вы",

    // Chart title
    chartTitle: "Сравнение карьерных траекторий",

    // Controls
    selectAspects: "Выберите аспекты для сравнения",
    applyButton: "Применить",

    // Overlap timeline
    overlapTitle: "🎯 Совпадение пути",
    totalDays: "Σ дней",
    longestStreak: "max",

    // Metrics table
    metricsTitle: "📊 Метрики схожести траекторий",
    metricsHeaders: ["№", "Тип", "Траектория", "Темп", "Стабильность", "Итого"],

    // Axis labels
    dateAxis: "Дата",

    // Hover
    reachedGoal: "🎯 Достиг цели",
  },
  en: {
    // Candidate types
    pathfinder: "Pathfinder",
    waymate: "Waymate",

    // Trajectory segments
    pathToGoal: "path to goal",
    afterGoal: "after",
    you: "You",

    // Chart title
    chartTitle: "Career Trajectory Comparison",

    // Controls
    selectAspects: "Select aspects to compare",
    applyButton: "Apply",

    // Overlap timeline
    overlapTitle: "🎯 Path Overlap",
    totalDays: "Total",
    longestStreak: "longest",

    // Metrics table
    metricsTitle: "📊 Trajectory Similarity Metrics",
    metricsHeaders: ["#", "Type", "Shape", "Tempo", "Stability", "Total"],

    // Axis labels
    dateAxis: "Date",

    // Hover
    reachedGoal: "🎯 Reached goal",
  },
} as const;

export type Labels = {
  pathfinder: string;
  waymate: string;
  pathToGoal: string;
  afterGoal: string;
  you: string;
  chartTitle: string;
  selectAspects: string;
  applyButton: string;
  overlapTitle: string;
  totalDays: string;
  longestStreak: string;
  metricsTitle: string;
  metricsHeaders: readonly string[];
  dateAxis: string;
  reachedGoal: string;
};

/**
 * Get labels for specified locale.
 */
export function getLabels(locale: Locale): Labels {
  return LABELS[locale];
}
