import { ASPECT_CONFIGS } from "../config/aspect-configs.js";

import type { ChartableField, Locale, ProcessedTrajectory, SimilarityMetrics } from "../types.js";

/**
 * Get label for candidate type badge.
 */
function getCandidateTypeLabel(type: "pathfinder" | "waymate" | null): string {
  if (type === "pathfinder") return "Pathfinder";
  if (type === "waymate") return "Waymate";
  return "—";
}

/**
 * Render field selection controls (checkboxes).
 */
export function renderControls(fields: ChartableField[], selected: ChartableField[], locale: Locale): string {
  const title = locale === "ru" ? "Выберите аспекты для сравнения" : "Select aspects to compare";
  const applyButton = locale === "ru" ? "Применить" : "Apply";

  const checkboxes = fields
    .map((field) => {
      const config = ASPECT_CONFIGS[field];
      const label = config.labels[locale];
      const checked = selected.includes(field) ? "checked" : "";
      return `<label><input type="checkbox" value="${field}" ${checked}> ${label}</label>`;
    })
    .join("\n      ");

  return `
    <div id="controls">
      <h3>${title}</h3>
      <div class="checkboxes">
        ${checkboxes}
      </div>
      <button id="apply-btn">${applyButton}</button>
    </div>
  `;
}

/**
 * Render metrics table with DTW scores.
 */
export function renderMetricsTable(
  metrics: SimilarityMetrics[],
  trajectories: ProcessedTrajectory[],
  locale: Locale,
): string {
  const title = locale === "ru" ? "📊 Метрики схожести траекторий" : "📊 Trajectory Similarity Metrics";
  const headers =
    locale === "ru"
      ? ["№", "Тип", "Траектория", "Темп", "Стабильность", "Итого"]
      : ["#", "Type", "Shape", "Tempo", "Stability", "Total"];

  const sortedMetrics = metrics.toSorted((a, b) => b.overall - a.overall);

  const rows = sortedMetrics
    .map((metric) => {
      const traj = trajectories.find((t) => t.id === metric.candidateId);
      if (!traj) return "";

      const typeLabel = getCandidateTypeLabel(metric.candidateType);
      const shape = metric.perField.position ? `${Math.round(metric.perField.position * 100)}%` : "—";
      const tempo = metric.perField.domains ? `${Math.round(metric.perField.domains * 100)}%` : "—";
      const stability = metric.perField.cityName ? `${Math.round(metric.perField.cityName * 100)}%` : "—";
      const total = metric.overall > 0 ? metric.overall.toFixed(2) : "—";

      return `
        <tr>
          <td>${traj.label}</td>
          <td>${typeLabel}</td>
          <td>${shape}</td>
          <td>${tempo}</td>
          <td>${stability}</td>
          <td><strong>${total}</strong></td>
        </tr>`;
    })
    .join("\n");

  return `
    <div id="metrics">
      <h4>${title}</h4>
      <table>
        <thead>
          <tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}
