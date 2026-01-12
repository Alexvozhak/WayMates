/**
 * Chart browser runtime — executes in browser, NOT Node.js.
 * Compiled by esbuild to dist/chart/browser/chart-runtime.js
 * Injected into HTML by HtmlRenderer.
 *
 * Expects global `chartData` and `GOAL_STAR_COLOR` to be defined before this script runs.
 */

// @ts-nocheck — browser runtime with pre-validated data
/* eslint-disable */

// === Types (import type — erased at compile time, no runtime dependency) ===

import type {
  CandidateType,
  ChartableField,
  ChartMode,
  DynamicLevels,
  GoalValues,
  OverlapSummary,
  ProcessedTrajectory,
  SimilarityMetrics,
  TrajectoryPoint,
} from "../types.js";

import { CANDIDATE_BADGE } from "../types.js";
import { ARRAY_OVERLAP_FIELDS, JITTER_STEP, MS_PER_DAY } from "../config/constants.js";

// === Browser-only types (not in types.ts) ===

type ChartData = {
  mode: ChartMode;
  trajectories: ProcessedTrajectory[];
  fields: ChartableField[];
  selectedFields: ChartableField[];
  metrics: SimilarityMetrics[];
  timeRange: { minTime: number; maxTime: number };
  goalValues: GoalValues;
  dynamicLevels: DynamicLevels;
  excludedOverlapFields: ChartableField[];
};

// === Globals (injected by HtmlRenderer before this script) ===

declare const chartData: ChartData;
declare const GOAL_STAR_COLOR: string;
declare const fieldLabels: Record<ChartableField, string>;
declare const goalLabels: { name: string; hover: string };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Plotly: any;

// === Window extensions for cross-function state ===

declare global {
  interface Window {
    overlapSummaries: OverlapSummary[];
    enabledCandidateIndices: number[];
  }
}

// === Helper Functions ===

function getFieldConfig(field: ChartableField): { label: string; levels: string[] } {
  const levels = chartData.dynamicLevels[field] || [];
  return { label: fieldLabels[field] || field, levels };
}

function hasGoal(): boolean {
  return chartData.goalValues && Object.keys(chartData.goalValues).length > 0;
}

function getSelectedFields(): ChartableField[] {
  const checkboxes = document.querySelectorAll("#aspect-checkboxes input:checked");
  return Array.from(checkboxes).map((input) => (input as HTMLInputElement).value as ChartableField);
}

function getOverlapFields(): ChartableField[] {
  const selected = getSelectedFields();
  const excluded = chartData.excludedOverlapFields || [];
  return selected.filter((f) => !excluded.includes(f));
}

function getEnabledCandidates(): string[] {
  const checkboxes = document.querySelectorAll("#candidate-checkboxes input:checked");
  return Array.from(checkboxes).map((input) => (input as HTMLInputElement).value);
}

function getShowConnectionLines(): boolean {
  const checkbox = document.getElementById("show-connection-lines") as HTMLInputElement | null;
  return checkbox ? checkbox.checked : false;
}

// === Trace Builders ===

function calculateJitterOffset(candidateIndex: number, totalCandidates: number): number {
  if (totalCandidates === 0) return 0;
  return (candidateIndex - (totalCandidates - 1) / 2) * JITTER_STEP;
}

// eslint-disable-next-line max-params
function buildTraceForTrajectory(
  traj: ProcessedTrajectory,
  field: ChartableField,
  xaxisId: string,
  yaxisId: string,
  levels: string[],
  jitterOffset: number,
): object {
  const x = traj.points.map((p) => new Date(p.timestamp));
  const rawValues = traj.points.map((p) => p.values[field]);
  const y =
    levels.length > 0
      ? rawValues.map((v) => (v === null ? null : levels.indexOf(v as string) + jitterOffset))
      : rawValues;
  const text = rawValues.map((v) => (v === null ? "—" : String(v)));
  const badge = traj.candidateType ? CANDIDATE_BADGE[traj.candidateType] : "";

  return {
    x,
    y,
    text,
    mode: "lines+markers",
    name: traj.label + badge,
    line: { color: traj.color, width: traj.width, shape: "hv" },
    marker: { size: 6, color: traj.color },
    legendgroup: traj.label,
    showlegend: field === chartData.selectedFields[0],
    hovertemplate: "<b>%{text}</b><br>%{x|%Y-%m-%d}<extra>" + traj.label + "</extra>",
    xaxis: xaxisId,
    yaxis: yaxisId,
  };
}

function buildTracesForField(
  field: ChartableField,
  xaxisId: string,
  yaxisId: string,
  enabledCandidates: string[],
): object[] {
  const traces: object[] = [];
  const config = getFieldConfig(field);
  const levels = config.levels;

  const userTraj = chartData.trajectories.find((t) => t.id === "user");
  const candidates = chartData.trajectories.filter((t) => t.id !== "user" && enabledCandidates.includes(t.id));

  // 1. Add candidates first (below)
  candidates.forEach((traj, idx) => {
    const jitterOffset = calculateJitterOffset(idx, candidates.length);
    traces.push(buildTraceForTrajectory(traj, field, xaxisId, yaxisId, levels, jitterOffset));
  });

  // 2. Add User last (on top)
  if (userTraj) {
    traces.push(buildTraceForTrajectory(userTraj, field, xaxisId, yaxisId, levels, 0));
  }

  return traces;
}

function buildAllTraces(fields: ChartableField[], enabledCandidates: string[]): object[] {
  const allTraces: object[] = [];
  fields.forEach((field, index) => {
    const xaxisId = index === 0 ? "x" : "x" + (index + 1);
    const yaxisId = index === 0 ? "y" : "y" + (index + 1);
    allTraces.push(...buildTracesForField(field, xaxisId, yaxisId, enabledCandidates));
  });
  return allTraces;
}

function buildGoalLineTraces(fields: ChartableField[]): object[] {
  if (!hasGoal()) return [];
  const traces: object[] = [];
  const minTime = chartData.timeRange.minTime;
  const maxTime = chartData.timeRange.maxTime;

  fields.forEach((field, index) => {
    const goalValue = chartData.goalValues[field];
    if (goalValue === null || goalValue === undefined) return;

    const config = getFieldConfig(field);
    const levels = config.levels;
    const xaxisId = index === 0 ? "x" : "x" + (index + 1);
    const yaxisId = index === 0 ? "y" : "y" + (index + 1);
    const yValue = levels.length > 0 ? levels.indexOf(goalValue as string) : goalValue;
    if (yValue === -1) return;

    traces.push({
      x: [new Date(minTime), new Date(maxTime)],
      y: [yValue, yValue],
      mode: "lines",
      name: goalLabels.name,
      line: { color: GOAL_STAR_COLOR, width: 2, dash: "dash" },
      legendgroup: "goal",
      showlegend: index === 0,
      hovertemplate: "<b>" + goalLabels.hover + ": " + goalValue + "</b><extra></extra>",
      xaxis: xaxisId,
      yaxis: yaxisId,
    });
  });
  return traces;
}

// === Overlap Functions ===

function checkFieldMatch(userPoint: TrajectoryPoint, candPoint: TrajectoryPoint, field: ChartableField): boolean {
  if (ARRAY_OVERLAP_FIELDS.includes(field)) {
    const userArr = userPoint.rawArrays?.[field] || [];
    const candArr = candPoint.rawArrays?.[field] || [];
    return userArr.some((v) => candArr.includes(v));
  }
  return userPoint.values[field] === candPoint.values[field];
}

function findFieldOverlaps(
  userPoints: TrajectoryPoint[],
  candPoints: TrajectoryPoint[],
  field: ChartableField,
): { start: number; end: number }[] {
  const overlaps: { start: number; end: number }[] = [];
  for (let ui = 0; ui < userPoints.length - 1; ui++) {
    const userPoint = userPoints[ui];
    const userNext = userPoints[ui + 1];
    const userValue = userPoint.values[field];
    if (userValue === null || userValue === undefined) continue;
    for (let ci = 0; ci < candPoints.length - 1; ci++) {
      const candPoint = candPoints[ci];
      const candNext = candPoints[ci + 1];
      if (!checkFieldMatch(userPoint, candPoint, field)) continue;
      const overlapStart = Math.max(userPoint.timestamp, candPoint.timestamp);
      const overlapEnd = Math.min(userNext.timestamp, candNext.timestamp);
      if (overlapStart < overlapEnd) overlaps.push({ start: overlapStart, end: overlapEnd });
    }
  }
  return overlaps;
}

function intersectIntervals(
  a: { start: number; end: number }[],
  b: { start: number; end: number }[],
): { start: number; end: number }[] {
  const result: { start: number; end: number }[] = [];
  for (const ia of a) {
    for (const ib of b) {
      const start = Math.max(ia.start, ib.start);
      const end = Math.min(ia.end, ib.end);
      if (start < end) result.push({ start, end });
    }
  }
  return result;
}

function findFullOverlaps(
  userTraj: ProcessedTrajectory,
  candTraj: ProcessedTrajectory,
  fields: ChartableField[],
): { start: number; end: number }[] {
  if (fields.length === 0) return [];
  let result = findFieldOverlaps(userTraj.points, candTraj.points, fields[0]);
  for (let i = 1; i < fields.length; i++) {
    result = intersectIntervals(result, findFieldOverlaps(userTraj.points, candTraj.points, fields[i]));
    if (result.length === 0) break;
  }
  return result;
}

function buildOverlapTraces(fields: ChartableField[], overlapYaxisId: string, enabledCandidates: string[]): object[] {
  if (chartData.mode !== "full") {
    window.overlapSummaries = [];
    window.enabledCandidateIndices = [];
    return [];
  }

  const excluded = chartData.excludedOverlapFields || [];
  const overlapFields = fields.filter((f) => !excluded.includes(f));
  const traces: object[] = [];
  const userTraj = chartData.trajectories[0];
  const candidates = chartData.trajectories.slice(1).filter((c) => enabledCandidates.includes(c.id));
  const summaries: OverlapSummary[] = [];

  candidates.forEach((cand, idx) => {
    const periods = findFullOverlaps(userTraj, cand, overlapFields);
    summaries.push({
      candidateId: cand.id,
      candidateLabel: cand.label,
      candidateColor: cand.color,
      periods,
      totalDays: periods.reduce((sum, p) => sum + Math.round((p.end - p.start) / MS_PER_DAY), 0),
      longestStreakDays: Math.max(0, ...periods.map((p) => Math.round((p.end - p.start) / MS_PER_DAY))),
    });
    periods.forEach((period) => {
      traces.push({
        x: [new Date(period.start), new Date(period.end)],
        y: [idx, idx],
        mode: "lines",
        line: { color: cand.color, width: 10 },
        opacity: 0.8,
        showlegend: false,
        hovertemplate:
          cand.label + ": " + Math.round((period.end - period.start) / MS_PER_DAY) + " days<extra></extra>",
        xaxis: "x",
        yaxis: overlapYaxisId,
      });
    });
  });

  window.overlapSummaries = summaries;
  window.enabledCandidateIndices = candidates.map((_, i) => i);
  return traces;
}

function buildConnectionShapes(
  fields: ChartableField[],
  enabledCandidates: string[],
  overlapDomain: [number, number],
): object[] {
  const shapes: object[] = [];
  const excluded = chartData.excludedOverlapFields || [];
  const overlapFields = fields.filter((f) => !excluded.includes(f));
  const userTraj = chartData.trajectories[0];
  const candidates = chartData.trajectories.slice(1).filter((c) => enabledCandidates.includes(c.id));
  if (candidates.length === 0) return shapes;

  const domainHeight = overlapDomain[1] - overlapDomain[0];
  const slotHeight = domainHeight / candidates.length;

  candidates.forEach((cand, idx) => {
    const periods = findFullOverlaps(userTraj, cand, overlapFields);
    const yPaper = overlapDomain[0] + (idx + 0.5) * slotHeight;
    periods.forEach((period) => {
      shapes.push({
        type: "line",
        x0: period.start,
        x1: period.start,
        y0: yPaper,
        y1: 0.95,
        xref: "x",
        yref: "paper",
        line: { color: cand.color, width: 1, dash: "dot" },
        opacity: 0.35,
      });
      shapes.push({
        type: "line",
        x0: period.end,
        x1: period.end,
        y0: yPaper,
        y1: 0.95,
        xref: "x",
        yref: "paper",
        line: { color: cand.color, width: 1, dash: "dot" },
        opacity: 0.35,
      });
    });
  });
  return shapes;
}

function buildGoalMarkerShapesAndAnnotations(enabledCandidates: string[]): { shapes: object[]; annotations: object[] } {
  const shapes: object[] = [];
  const annotations: object[] = [];
  if (!hasGoal()) return { shapes, annotations };

  chartData.trajectories.forEach((traj) => {
    if (traj.matchedContextIndex === undefined || traj.matchedContextIndex < 0) return;
    if (!enabledCandidates.includes(traj.id)) return;

    const matchedDate = traj.points[traj.matchedContextIndex].timestamp;
    shapes.push({
      type: "line",
      x0: matchedDate,
      x1: matchedDate,
      y0: 0.02,
      y1: 0.95,
      xref: "x",
      yref: "paper",
      line: { color: traj.color, width: 2, dash: "dot" },
      opacity: 0.7,
    });
    annotations.push({
      x: matchedDate,
      y: 0.97,
      xref: "x",
      yref: "paper",
      text: "⭐",
      showarrow: false,
      font: { size: 20 },
      xanchor: "center",
      yanchor: "bottom",
      hovertext: traj.label + " reached goal",
    });
    annotations.push({
      x: matchedDate,
      y: 0.96,
      xref: "x",
      yref: "paper",
      text: traj.label,
      showarrow: false,
      font: { size: 10, color: traj.color },
      xanchor: "center",
      yanchor: "top",
    });
  });
  return { shapes, annotations };
}

// === Layout Builder ===

type LayoutResult = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  layout: any;
  overlapAxisNum: number;
  overlapDomain: [number, number];
};

function buildLayout(fields: ChartableField[], enabledCandidates: string[], title: string): LayoutResult {
  const numFields = fields.length;
  const candidates = chartData.trajectories.slice(1).filter((c) => enabledCandidates.includes(c.id));
  const isCandidatesOnly = chartData.mode !== "full";
  const overlapHeight = isCandidatesOnly ? 0 : candidates.length > 0 ? 0.1 + candidates.length * 0.03 : 0.12;
  const chartAreaTop = 0.95;
  const chartAreaBottom = isCandidatesOnly ? 0.05 : overlapHeight + 0.05;
  const chartHeight = chartAreaTop - chartAreaBottom;
  const gap = 0.015;

  const levelCounts = fields.map((f) => Math.max(getFieldConfig(f).levels.length, 2));
  const totalLevels = levelCounts.reduce((sum, c) => sum + c, 0);
  const totalGaps = (numFields - 1) * gap;
  const availableHeight = chartHeight - totalGaps;
  const subplotHeights = levelCounts.map((count) => availableHeight * (count / totalLevels));

  const maxLevels = Math.max(...levelCounts);
  const extraHeightPerField = maxLevels > 5 ? (maxLevels - 5) * 15 : 0;
  const baseHeight = isCandidatesOnly
    ? 300 + numFields * (160 + extraHeightPerField)
    : 300 + numFields * (160 + extraHeightPerField) + Math.max(candidates.length, 2) * 40;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const layout: any = {
    title: { text: title, font: { size: 18 } },
    showlegend: true,
    legend: { x: 1.02, y: 1, xanchor: "left" },
    hovermode: "closest",
    height: baseHeight,
    margin: { l: 180, r: 150, t: 60 },
    annotations: [],
    shapes: [],
  };

  let cumulativeHeight = 0;
  const domainTops = subplotHeights.map((h, i) => {
    const top = chartAreaTop - cumulativeHeight - (i > 0 ? gap : 0);
    cumulativeHeight += h + (i > 0 ? gap : 0);
    return top;
  });

  fields.forEach((field, index) => {
    const config = getFieldConfig(field);
    const yaxisKey = index === 0 ? "yaxis" : "yaxis" + (index + 1);
    const xaxisKey = index === 0 ? "xaxis" : "xaxis" + (index + 1);
    const domainTop = domainTops[index];
    const domainBottom = domainTop - subplotHeights[index];
    const domainMid = (domainTop + Math.max(domainBottom, chartAreaBottom)) / 2;

    const levelCount = config.levels.length;
    const tickSize = levelCount > 12 ? 6 : levelCount > 8 ? 7 : levelCount > 5 ? 8 : 10;
    const tickPadding = levelCount > 5 ? 8 : 3;

    layout[yaxisKey] = {
      domain: [Math.max(domainBottom, chartAreaBottom), domainTop],
      anchor: index === 0 ? "x" : "x" + (index + 1),
      tickmode: levelCount > 0 ? "array" : "auto",
      tickvals: levelCount > 0 ? config.levels.map((_, i) => i) : undefined,
      ticktext: levelCount > 0 ? config.levels : undefined,
      tickfont: { size: tickSize, color: "#6b7280" },
      ticklabelstandoff: tickPadding,
      automargin: true,
    };
    layout[xaxisKey] = {
      type: "date",
      anchor: index === 0 ? "y" : "y" + (index + 1),
      showticklabels: false,
    };

    layout.annotations.push({
      text: "<b>" + config.label + "</b>",
      xref: "paper",
      yref: "paper",
      x: -0.08,
      y: domainMid,
      textangle: -90,
      xanchor: "center",
      yanchor: "middle",
      font: { size: 14, color: "#1e3a5f" },
      showarrow: false,
    });
  });

  const overlapAxisNum = numFields + 1;
  if (!isCandidatesOnly) {
    const candidateLabels = candidates.map((t) => t.label);
    layout["yaxis" + overlapAxisNum] = {
      title: { text: "Overlap", font: { size: 12 } },
      domain: [0.02, overlapHeight],
      anchor: "x",
      tickmode: "array",
      tickvals: candidateLabels.map((_, i) => i),
      ticktext: candidateLabels,
      tickfont: { size: 11 },
      fixedrange: true,
      gridcolor: "#e5e7eb",
    };
  }

  layout.xaxis = layout.xaxis || {};
  layout.xaxis.title = { text: "Date", font: { size: 12 } };
  layout.xaxis.showticklabels = true;
  layout.xaxis.tickfont = { size: 10 };

  return { layout, overlapAxisNum, overlapDomain: [0.02, overlapHeight] };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function addOverlapAnnotations(layout: any, summaries: OverlapSummary[], enabledCandidateIndices: number[]): void {
  if (!summaries || summaries.length === 0) return;
  summaries.forEach((summary, idx) => {
    const yPos = enabledCandidateIndices[idx];
    const text = summary.totalDays > 0 ? summary.totalDays + "d (max: " + summary.longestStreakDays + "d)" : "—";
    layout.annotations.push({
      xref: "paper",
      yref: "y" + (chartData.selectedFields.length + 1),
      x: 1.01,
      y: yPos,
      xanchor: "left",
      yanchor: "middle",
      text: text,
      showarrow: false,
      font: { size: 11, color: summary.totalDays > 0 ? summary.candidateColor : "#9ca3af" },
    });
  });
}

// === Render Functions ===

function updateMetricsTable(enabledCandidates: string[]): void {
  const rows = document.querySelectorAll("#metrics tbody tr");
  rows.forEach((row) => {
    const candidateId = row.getAttribute("data-candidate-id");
    if (candidateId) {
      (row as HTMLElement).style.display = enabledCandidates.includes(candidateId) ? "" : "none";
    }
  });
}

function buildSpiderTraces(enabledCandidates: string[]): object[] {
  const traces: object[] = [];
  const axes = ["Shape", "Tempo", "Alignment", "Shape"];
  const userTraj = chartData.trajectories[0];

  traces.push({
    type: "scatterpolar",
    r: [1, 1, 1, 1],
    theta: axes,
    fill: "toself",
    fillcolor: userTraj.color + "40",
    mode: "lines+markers",
    name: userTraj.label + " (reference)",
    line: { color: userTraj.color, width: 2, dash: "dash" },
    marker: { size: 5, color: userTraj.color },
    hovertemplate: "%{theta}: 100%<extra>" + userTraj.label + "</extra>",
  });

  chartData.metrics.forEach((metric) => {
    if (!enabledCandidates.includes(metric.candidateId)) return;
    const traj = chartData.trajectories.find((t) => t.id === metric.candidateId);
    if (!traj) return;
    const shape = metric.perField.position || 0;
    const tempo = metric.perField.domains || 0;
    const alignment = metric.perField.cityName || 0;

    traces.push({
      type: "scatterpolar",
      r: [shape, tempo, alignment, shape],
      theta: axes,
      fill: "toself",
      fillcolor: traj.color + "30",
      mode: "lines+markers",
      name: traj.label,
      line: { color: traj.color, width: 2 },
      marker: { size: 6, color: traj.color },
      hovertemplate: "%{theta}: %{r:.0%}<extra>" + traj.label + "</extra>",
    });
  });
  return traces;
}

function renderSpiderChart(enabledCandidates: string[]): void {
  if (chartData.mode !== "full") return;
  const spiderEl = document.getElementById("spider-chart");
  if (!spiderEl) return;

  const traces = buildSpiderTraces(enabledCandidates);
  if (traces.length <= 1) {
    spiderEl.innerHTML = '<p style="color:#9ca3af;text-align:center;padding:20px;">No DTW data</p>';
    return;
  }

  const layout = {
    polar: {
      radialaxis: {
        visible: true,
        range: [0, 1],
        tickmode: "array",
        tickvals: [0.25, 0.5, 0.75, 1],
        ticktext: ["", "", "", ""],
        tickfont: { size: 10 },
        gridcolor: "#e5e7eb",
        linecolor: "#9ca3af",
        angle: 90,
      },
      angularaxis: {
        tickfont: { size: 13, color: "#1f2937", weight: 600 },
        gridcolor: "#d1d5db",
        rotation: 90,
        direction: "clockwise",
      },
      bgcolor: "#f9fafb",
    },
    showlegend: true,
    legend: { x: 0.5, xanchor: "center", y: -0.18, orientation: "h", font: { size: 11 } },
    margin: { t: 20, b: 70, l: 50, r: 50 },
    height: 350,
    dragmode: false,
  };

  Plotly.newPlot("spider-chart", traces, layout, { responsive: true, displayModeBar: false, staticPlot: true });
}

function renderChart(title: string): void {
  const fields = getSelectedFields();
  const overlapFields = getOverlapFields();
  const enabledCandidates = getEnabledCandidates();
  const showConnectionLines = getShowConnectionLines();

  if (fields.length === 0) {
    const mainChart = document.getElementById("main-chart");
    if (mainChart) {
      mainChart.innerHTML = '<p style="padding:40px;text-align:center;color:#6b7280;">Select at least one aspect</p>';
    }
    return;
  }
  chartData.selectedFields = fields;

  const traces = buildAllTraces(fields, enabledCandidates);
  const goalLineTraces = buildGoalLineTraces(fields);
  const { layout, overlapAxisNum, overlapDomain } = buildLayout(fields, enabledCandidates, title);
  const overlapTraces = buildOverlapTraces(overlapFields, "y" + overlapAxisNum, enabledCandidates);
  const allTraces = [...traces, ...goalLineTraces, ...overlapTraces];

  if (showConnectionLines) {
    layout.shapes = buildConnectionShapes(overlapFields, enabledCandidates, overlapDomain);
  }

  const goalMarkers = buildGoalMarkerShapesAndAnnotations(enabledCandidates);
  layout.shapes = [...(layout.shapes || []), ...goalMarkers.shapes];
  layout.annotations = [...(layout.annotations || []), ...goalMarkers.annotations];
  addOverlapAnnotations(layout, window.overlapSummaries, window.enabledCandidateIndices);

  Plotly.newPlot("main-chart", allTraces, layout, {
    responsive: true,
    displayModeBar: true,
    modeBarButtonsToRemove: ["lasso2d", "select2d"],
    toImageButtonOptions: {
      format: "png",
      filename: "career-trajectory-comparison",
      height: 900,
      width: 1400,
      scale: 2,
    },
  });

  updateMetricsTable(enabledCandidates);
  renderSpiderChart(enabledCandidates);
}

// === Event Handlers ===

function setupEventHandlers(title: string): void {
  const aspectCheckboxes = document.querySelectorAll("#aspect-checkboxes input");
  const candidateCheckboxes = document.querySelectorAll("#candidate-checkboxes input");
  const connectionLinesCheckbox = document.getElementById("show-connection-lines");

  const handler = () => renderChart(title);

  aspectCheckboxes.forEach((el) => el.addEventListener("change", handler));
  candidateCheckboxes.forEach((el) => el.addEventListener("change", handler));
  if (connectionLinesCheckbox) {
    connectionLinesCheckbox.addEventListener("change", handler);
  }

  const exportBtn = document.getElementById("export-btn");
  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      Plotly.downloadImage("main-chart", {
        format: "png",
        width: 1400,
        height: 900,
        filename: "career-trajectory-comparison",
        scale: 2,
      });
    });
  }
}

// === Main Entry Point ===

export function initChart(title: string): void {
  renderChart(title);
  setupEventHandlers(title);
}
