import { ASPECT_CONFIGS } from "../config/aspect-configs.js";
import { getLabels } from "../config/labels.js";

import type { ChartableField, Locale, OverlapSummary, ProcessedTrajectory, SimilarityMetrics } from "../types.js";

/**
 * Get label for candidate type badge.
 */
function getCandidateTypeLabel(type: "pathfinder" | "waymate" | null, locale: Locale): string {
  const labels = getLabels(locale);
  if (type === "pathfinder") return labels.pathfinder;
  if (type === "waymate") return labels.waymate;
  return "—";
}

/**
 * Render field selection controls (checkboxes).
 */
export function renderControls(fields: ChartableField[], selected: ChartableField[], locale: Locale): string {
  const labels = getLabels(locale);
  const title = labels.selectAspects;
  const applyButton = labels.applyButton;

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
  const labels = getLabels(locale);
  const title = labels.metricsTitle;
  const headers = labels.metricsHeaders;

  const sortedMetrics = metrics.toSorted((a, b) => b.overall - a.overall);

  const rows = sortedMetrics
    .map((metric) => {
      const traj = trajectories.find((t) => t.id === metric.candidateId);
      if (!traj) return "";

      const typeLabel = getCandidateTypeLabel(metric.candidateType, locale);
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

/**
 * Render Overlap Timeline section.
 * Shows horizontal dashed bars for full overlap periods, aligned with chart X-axis.
 */
export function renderOverlapTimeline(
  summaries: OverlapSummary[],
  timeRange: { minTime: number; maxTime: number },
  locale: Locale,
): string {
  const labels = getLabels(locale);
  const title = labels.overlapTitle;
  const totalLabel = labels.totalDays;
  const longestLabel = labels.longestStreak;

  const rangeDuration = timeRange.maxTime - timeRange.minTime;
  if (rangeDuration <= 0) return "";

  const rows = summaries
    .map((summary) => {
      const bars = summary.periods
        .map((period) => {
          const leftPct = ((period.startTime - timeRange.minTime) / rangeDuration) * 100;
          const widthPct = ((period.endTime - period.startTime) / rangeDuration) * 100;
          return `<div class="overlap-bar" style="left:${leftPct.toFixed(1)}%;width:${widthPct.toFixed(1)}%;background:${summary.candidateColor};"></div>`;
        })
        .join("");

      const statsText =
        summary.totalDays > 0 ? `${summary.totalDays}d (${longestLabel}: ${summary.longestStreakDays}d)` : "—";

      return `
        <div class="overlap-row">
          <div class="overlap-label" style="color:${summary.candidateColor};">${summary.candidateLabel}</div>
          <div class="overlap-track">${bars}</div>
          <div class="overlap-stats">${statsText}</div>
        </div>`;
    })
    .join("");

  return `
    <div id="overlap-timeline">
      <h4>${title}</h4>
      <div class="overlap-container">
        ${rows}
      </div>
      <div class="overlap-legend">
        <span>${totalLabel}</span> / <span>${longestLabel}</span>
      </div>
    </div>
  `;
}
