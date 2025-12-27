import { GOAL_STAR_COLOR } from "../config/colors.js";

import type {
  ChartableField,
  ChartMode,
  DynamicLevels,
  GoalValues,
  Locale,
  OverlapSummary,
  ProcessedTrajectory,
  SimilarityMetrics,
} from "../types.js";

export type ChartRenderData = {
  mode: ChartMode;
  trajectories: ProcessedTrajectory[];
  fields: ChartableField[];
  metrics: SimilarityMetrics[];
  overlapSummaries: OverlapSummary[];
  timeRange: { minTime: number; maxTime: number };
  locale: Locale;
  goalValues: GoalValues;
  dynamicLevels: DynamicLevels;
};

const FIELD_LABELS: Record<ChartableField, string> = {
  position: "Grade",
  role: "Role",
  domains: "Domain",
  countryCode: "Country",
  cityName: "City",
  industry: "Industry",
  salaryExact: "Salary",
};

/**
 * Renders chart data into complete HTML document with embedded Plotly.js.
 * Single responsibility: HTML generation from prepared data.
 */
export class HtmlRenderer {
  private readonly title = "Career Trajectory Comparison";

  constructor(private readonly data: ChartRenderData) {}

  render(): string {
    return this.buildHtmlDocument();
  }

  /** Check if any candidate has real DTW data (not empty metrics) */
  private get hasDtwData(): boolean {
    return this.data.metrics.some((m) => m.overall > 0);
  }

  private buildHtmlDocument(): string {
    const showDtwSection = this.data.mode === "full" && this.hasDtwData;
    const spiderSection = showDtwSection
      ? `<div id="spider-chart-container">
      <h4>DTW Similarity</h4>
      <div id="spider-chart"></div>
    </div>`
      : "";

    return `<!DOCTYPE html>
<html lang="${this.data.locale}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.title}</title>
  <script src="https://cdn.plot.ly/plotly-2.27.0.min.js"></script>
  ${this.buildStyles()}
</head>
<body>
  ${this.buildControls()}
  <div id="charts-row">
    <div id="main-chart-container">
      <div id="main-chart"></div>
    </div>
    ${spiderSection}
  </div>
  ${this.buildMetricsTable()}
  ${this.buildScript()}
</body>
</html>`;
  }

  private buildStyles(): string {
    return `<style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 95%; margin: 0 auto; padding: 20px; background: #f9fafb; }
    #controls { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .controls-row { display: flex; gap: 30px; flex-wrap: wrap; align-items: flex-start; }
    .control-group { flex: 1; min-width: 150px; }
    .control-group h4 { margin: 0 0 10px 0; font-size: 13px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
    .checkboxes { display: flex; flex-direction: column; gap: 6px; }
    .checkboxes label { display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 14px; }
    .checkboxes input[type="checkbox"] { width: 16px; height: 16px; }
    .candidate-label { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 4px; }
    .buttons-group { display: flex; gap: 10px; align-items: flex-end; padding-bottom: 5px; }
    #export-btn { background: #10b981; color: white; border: none; padding: 10px 24px; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500; }
    #export-btn:hover { background: #059669; }
    #main-chart { }
    #metrics { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    #metrics table { width: 100%; border-collapse: collapse; }
    #metrics th, #metrics td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    #metrics th { background: #f3f4f6; font-weight: 600; }
    #charts-row { display: flex; gap: 20px; margin-bottom: 20px; }
    #main-chart-container { flex: 1; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    #spider-chart-container { width: 350px; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    #spider-chart-container h4 { margin: 0 0 10px 0; font-size: 14px; color: #374151; }
  </style>`;
  }

  private buildControls(): string {
    const aspectCheckboxes = this.data.fields
      .map((field) => {
        const label = FIELD_LABELS[field];
        return `<label><input type="checkbox" value="${field}" checked> ${label}</label>`;
      })
      .join("\n            ");

    const candidates = this.data.trajectories.slice(1);
    const candidateCheckboxes = candidates
      .map((traj) => {
        const badge = traj.isWaymate ? " (Waymate)" : "";
        return `<label>
              <input type="checkbox" value="${traj.id}" checked>
              <span class="candidate-label" style="background:${traj.color};"></span>
              ${traj.label}${badge}
            </label>`;
      })
      .join("\n            ");

    return `
    <div id="controls">
      <div class="controls-row">
        <div class="control-group">
          <h4>Aspects</h4>
          <div class="checkboxes" id="aspect-checkboxes">
            ${aspectCheckboxes}
          </div>
        </div>
        <div class="control-group">
          <h4>Candidates</h4>
          <div class="checkboxes" id="candidate-checkboxes">
            ${candidateCheckboxes}
          </div>
        </div>
        <div class="control-group">
          <h4>Options</h4>
          <div class="checkboxes">
            <label>
              <input type="checkbox" id="show-connection-lines">
              Show connection lines
            </label>
          </div>
        </div>
        <div class="buttons-group">
          <button id="export-btn">Export PNG</button>
        </div>
      </div>
    </div>
  `;
  }

  private buildMetricsTable(): string {
    if (!this.hasDtwData) return "";

    const headers = ["#", "Type", "Shape", "Tempo", "Alignment", "Total"];
    const sortedMetrics = this.data.metrics.toSorted((a, b) => b.overall - a.overall);

    const rows = sortedMetrics
      .map((metric) => {
        const traj = this.data.trajectories.find((t) => t.id === metric.candidateId);
        if (!traj) return "";

        const typeLabel = metric.isWaymate ? "Waymate" : "—";
        const shape = metric.perField.position ? `${Math.round(metric.perField.position * 100)}%` : "—";
        const tempo = metric.perField.domains ? `${Math.round(metric.perField.domains * 100)}%` : "—";
        const alignment = metric.perField.cityName ? `${Math.round(metric.perField.cityName * 100)}%` : "—";
        const total = metric.overall > 0 ? metric.overall.toFixed(2) : "—";

        return `
        <tr data-candidate-id="${metric.candidateId}">
          <td>${traj.label}</td>
          <td>${typeLabel}</td>
          <td>${shape}</td>
          <td>${tempo}</td>
          <td>${alignment}</td>
          <td><strong>${total}</strong></td>
        </tr>`;
      })
      .join("\n");

    return `
    <div id="metrics">
      <h4>Trajectory Similarity Metrics</h4>
      <table>
        <thead>
          <tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
  }

  private buildScript(): string {
    const chartDataJson = JSON.stringify({
      mode: this.data.mode,
      trajectories: this.data.trajectories,
      fields: this.data.fields,
      selectedFields: this.data.fields,
      metrics: this.data.metrics,
      overlapSummaries: this.data.overlapSummaries,
      timeRange: this.data.timeRange,
      goalValues: this.data.goalValues,
      dynamicLevels: this.data.dynamicLevels,
    });

    return `<script>
    const chartData = ${chartDataJson};
    const GOAL_STAR_COLOR = '${GOAL_STAR_COLOR}';
    const MS_PER_DAY = 86400000;

    ${this.buildPlotlyHelpers()}
    ${this.buildTraceBuilders()}
    ${this.buildOverlapFunctions()}
    ${this.buildLayoutBuilder()}
    ${this.buildRenderFunctions()}
    ${this.buildEventHandlers()}

    // Initial render
    renderChart();
  </script>`;
  }

  private buildPlotlyHelpers(): string {
    return `
    function getFieldConfig(field) {
      const labels = {
        position: 'Grade',
        role: 'Role',
        domains: 'Domain',
        cityName: 'City',
        industry: 'Industry',
        salaryExact: 'Salary'
      };
      const levels = chartData.dynamicLevels[field] || [];
      return { label: labels[field] || field, levels };
    }

    function hasGoal() {
      return chartData.goalValues && Object.keys(chartData.goalValues).length > 0;
    }

    function getSelectedFields() {
      return Array.from(document.querySelectorAll('#aspect-checkboxes input:checked')).map(input => input.value);
    }

    function getEnabledCandidates() {
      return Array.from(document.querySelectorAll('#candidate-checkboxes input:checked')).map(input => input.value);
    }

    function getShowConnectionLines() {
      const checkbox = document.getElementById('show-connection-lines');
      return checkbox ? checkbox.checked : false;
    }`;
  }

  // eslint-disable-next-line max-lines-per-function -- JS string generation for browser
  private buildTraceBuilders(): string {
    return `
    const JITTER_STEP = 0.08;

    function calculateJitterOffset(candidateIndex, totalCandidates) {
      if (totalCandidates === 0) return 0;
      return (candidateIndex - (totalCandidates - 1) / 2) * JITTER_STEP;
    }

    function buildTraceForTrajectory(traj, field, xaxisId, yaxisId, levels, jitterOffset) {
      const x = traj.points.map(p => new Date(p.timestamp));
      const rawValues = traj.points.map(p => p.values[field]);
      const y = levels.length > 0 ? rawValues.map(v => v === null ? null : levels.indexOf(v) + jitterOffset) : rawValues;
      const text = rawValues.map(v => v === null ? '—' : String(v));
      const badge = traj.isWaymate ? ' (Waymate)' : '';
      return {
        x, y, text, mode: 'lines+markers', name: traj.label + badge,
        line: { color: traj.color, width: traj.width, shape: 'hv' },
        marker: { size: 6, color: traj.color }, legendgroup: traj.label,
        showlegend: field === chartData.selectedFields[0],
        hovertemplate: '<b>%{text}</b><br>%{x|%Y-%m-%d}<extra>' + traj.label + '</extra>',
        xaxis: xaxisId, yaxis: yaxisId
      };
    }

    function buildTracesForField(field, xaxisId, yaxisId, enabledCandidates) {
      const traces = [];
      const config = getFieldConfig(field);
      const levels = config.levels;

      const userTraj = chartData.trajectories.find(t => t.id === 'user');
      const candidates = chartData.trajectories.filter(t => t.id !== 'user' && enabledCandidates.includes(t.id));

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

    function buildAllTraces(fields, enabledCandidates) {
      const allTraces = [];
      fields.forEach((field, index) => {
        const xaxisId = index === 0 ? 'x' : 'x' + (index + 1);
        const yaxisId = index === 0 ? 'y' : 'y' + (index + 1);
        allTraces.push(...buildTracesForField(field, xaxisId, yaxisId, enabledCandidates));
      });
      return allTraces;
    }

    function buildGoalLineTraces(fields) {
      if (!hasGoal()) return [];
      const traces = [];
      const minTime = chartData.timeRange.minTime;
      const maxTime = chartData.timeRange.maxTime;

      fields.forEach((field, index) => {
        const goalValue = chartData.goalValues[field];
        if (goalValue === null || goalValue === undefined) return;

        const config = getFieldConfig(field);
        const levels = config.levels;
        const xaxisId = index === 0 ? 'x' : 'x' + (index + 1);
        const yaxisId = index === 0 ? 'y' : 'y' + (index + 1);
        const yValue = levels.length > 0 ? levels.indexOf(goalValue) : goalValue;
        if (yValue === -1) return;

        traces.push({
          x: [new Date(minTime), new Date(maxTime)], y: [yValue, yValue],
          mode: 'lines', name: 'Ваша цель',
          line: { color: GOAL_STAR_COLOR, width: 2, dash: 'dash' },
          legendgroup: 'goal', showlegend: index === 0,
          hovertemplate: '<b>Цель: ' + goalValue + '</b><extra></extra>',
          xaxis: xaxisId, yaxis: yaxisId
        });
      });
      return traces;
    }`;
  }

  // eslint-disable-next-line max-lines-per-function -- JS string generation
  private buildOverlapFunctions(): string {
    return `
    function findFieldOverlaps(userPoints, candPoints, field) {
      const overlaps = [];
      for (let ui = 0; ui < userPoints.length - 1; ui++) {
        const userPoint = userPoints[ui];
        const userNext = userPoints[ui + 1];
        const userValue = userPoint.values[field];
        if (userValue === null || userValue === undefined) continue;
        for (let ci = 0; ci < candPoints.length - 1; ci++) {
          const candPoint = candPoints[ci];
          const candNext = candPoints[ci + 1];
          if (candPoint.values[field] !== userValue) continue;
          const overlapStart = Math.max(userPoint.timestamp, candPoint.timestamp);
          const overlapEnd = Math.min(userNext.timestamp, candNext.timestamp);
          if (overlapStart < overlapEnd) overlaps.push({ start: overlapStart, end: overlapEnd });
        }
      }
      return overlaps;
    }

    function intersectIntervals(a, b) {
      const result = [];
      for (const ia of a) {
        for (const ib of b) {
          const start = Math.max(ia.start, ib.start);
          const end = Math.min(ia.end, ib.end);
          if (start < end) result.push({ start, end });
        }
      }
      return result;
    }

    function findFullOverlaps(userTraj, candTraj, fields) {
      if (fields.length === 0) return [];
      let result = findFieldOverlaps(userTraj.points, candTraj.points, fields[0]);
      for (let i = 1; i < fields.length; i++) {
        result = intersectIntervals(result, findFieldOverlaps(userTraj.points, candTraj.points, fields[i]));
        if (result.length === 0) break;
      }
      return result;
    }

    function buildOverlapTraces(fields, overlapYaxisId, enabledCandidates) {
      if (chartData.mode !== 'full') {
        window.overlapSummaries = [];
        window.enabledCandidateIndices = [];
        return [];
      }
      const traces = [];
      const userTraj = chartData.trajectories[0];
      const candidates = chartData.trajectories.slice(1).filter(c => enabledCandidates.includes(c.id));
      const summaries = [];

      candidates.forEach((cand, idx) => {
        const periods = findFullOverlaps(userTraj, cand, fields);
        summaries.push({ candidateId: cand.id, candidateLabel: cand.label, candidateColor: cand.color, periods,
          totalDays: periods.reduce((sum, p) => sum + Math.round((p.end - p.start) / MS_PER_DAY), 0),
          longestStreakDays: Math.max(0, ...periods.map(p => Math.round((p.end - p.start) / MS_PER_DAY)))
        });
        periods.forEach((period) => {
          traces.push({
            x: [new Date(period.start), new Date(period.end)], y: [idx, idx],
            mode: 'lines', line: { color: cand.color, width: 10 }, opacity: 0.8, showlegend: false,
            hovertemplate: cand.label + ': ' + Math.round((period.end - period.start) / MS_PER_DAY) + ' days<extra></extra>',
            xaxis: 'x', yaxis: overlapYaxisId
          });
        });
      });
      window.overlapSummaries = summaries;
      window.enabledCandidateIndices = candidates.map((_, i) => i);
      return traces;
    }

    function buildConnectionShapes(fields, enabledCandidates, overlapDomain) {
      const shapes = [];
      const userTraj = chartData.trajectories[0];
      const candidates = chartData.trajectories.slice(1).filter(c => enabledCandidates.includes(c.id));
      if (candidates.length === 0) return shapes;
      const domainHeight = overlapDomain[1] - overlapDomain[0];
      const slotHeight = domainHeight / candidates.length;

      candidates.forEach((cand, idx) => {
        const periods = findFullOverlaps(userTraj, cand, fields);
        const yPaper = overlapDomain[0] + (idx + 0.5) * slotHeight;
        periods.forEach((period) => {
          shapes.push({ type: 'line', x0: period.start, x1: period.start, y0: yPaper, y1: 0.95, xref: 'x', yref: 'paper',
            line: { color: cand.color, width: 1, dash: 'dot' }, opacity: 0.35 });
          shapes.push({ type: 'line', x0: period.end, x1: period.end, y0: yPaper, y1: 0.95, xref: 'x', yref: 'paper',
            line: { color: cand.color, width: 1, dash: 'dot' }, opacity: 0.35 });
        });
      });
      return shapes;
    }

    function buildGoalMarkerShapesAndAnnotations(enabledCandidates) {
      const shapes = [];
      const annotations = [];
      if (!hasGoal()) return { shapes, annotations };

      chartData.trajectories.forEach(traj => {
        // Only show goal markers for candidates with matchedContextIndex (pathfinders from searchPathfinders)
        if (traj.matchedContextIndex === undefined || traj.matchedContextIndex < 0) return;
        if (!enabledCandidates.includes(traj.id)) return;

        const matchedDate = traj.points[traj.matchedContextIndex].timestamp;
        shapes.push({ type: 'line', x0: matchedDate, x1: matchedDate, y0: 0.02, y1: 0.95, xref: 'x', yref: 'paper',
          line: { color: traj.color, width: 2, dash: 'dot' }, opacity: 0.7 });
        annotations.push({ x: matchedDate, y: 0.97, xref: 'x', yref: 'paper', text: '⭐', showarrow: false,
          font: { size: 20 }, xanchor: 'center', yanchor: 'bottom', hovertext: traj.label + ' reached goal' });
        annotations.push({ x: matchedDate, y: 0.96, xref: 'x', yref: 'paper', text: traj.label, showarrow: false,
          font: { size: 10, color: traj.color }, xanchor: 'center', yanchor: 'top' });
      });
      return { shapes, annotations };
    }`;
  }

  // eslint-disable-next-line max-lines-per-function -- JS string generation
  private buildLayoutBuilder(): string {
    return `
    function buildLayout(fields, enabledCandidates) {
      const numFields = fields.length;
      const candidates = chartData.trajectories.slice(1).filter(c => enabledCandidates.includes(c.id));
      const isCandidatesOnly = chartData.mode !== 'full';
      const overlapHeight = isCandidatesOnly ? 0 : (candidates.length > 0 ? 0.10 + candidates.length * 0.03 : 0.12);
      const chartAreaTop = 0.95;
      const chartAreaBottom = isCandidatesOnly ? 0.05 : overlapHeight + 0.05;
      const chartHeight = chartAreaTop - chartAreaBottom;
      const subplotHeight = chartHeight / numFields;
      const gap = 0.015;

      const layout = {
        title: { text: '${this.title}', font: { size: 18 } },
        showlegend: true, legend: { x: 1.02, y: 1, xanchor: 'left' },
        hovermode: 'closest',
        height: isCandidatesOnly ? 300 + numFields * 160 : 300 + numFields * 160 + Math.max(candidates.length, 2) * 40,
        margin: { l: 150, r: 150, t: 60 }, annotations: [], shapes: []
      };

      fields.forEach((field, index) => {
        const config = getFieldConfig(field);
        const yaxisKey = index === 0 ? 'yaxis' : 'yaxis' + (index + 1);
        const xaxisKey = index === 0 ? 'xaxis' : 'xaxis' + (index + 1);
        const domainTop = chartAreaTop - index * (subplotHeight + gap);
        const domainBottom = domainTop - subplotHeight + gap;

        layout[yaxisKey] = {
          title: { text: config.label, font: { size: 12 } },
          domain: [Math.max(domainBottom, chartAreaBottom), domainTop],
          anchor: index === 0 ? 'x' : 'x' + (index + 1),
          tickmode: config.levels.length > 0 ? 'array' : 'auto',
          tickvals: config.levels.length > 0 ? config.levels.map((_, i) => i) : undefined,
          ticktext: config.levels.length > 0 ? config.levels : undefined,
          tickfont: { size: 10 }
        };
        layout[xaxisKey] = { type: 'date', anchor: index === 0 ? 'y' : 'y' + (index + 1), showticklabels: false };
      });

      const overlapAxisNum = numFields + 1;
      if (!isCandidatesOnly) {
        const candidateLabels = candidates.map(t => t.label);
        layout['yaxis' + overlapAxisNum] = {
          title: { text: 'Overlap', font: { size: 12 } }, domain: [0.02, overlapHeight], anchor: 'x',
          tickmode: 'array', tickvals: candidateLabels.map((_, i) => i), ticktext: candidateLabels,
          tickfont: { size: 11 }, fixedrange: true, gridcolor: '#e5e7eb'
        };
      }

      layout.xaxis = layout.xaxis || {};
      layout.xaxis.title = { text: 'Date', font: { size: 12 } };
      layout.xaxis.showticklabels = true;
      layout.xaxis.tickfont = { size: 10 };

      return { layout, overlapAxisNum, overlapDomain: [0.02, overlapHeight] };
    }

    function addOverlapAnnotations(layout, summaries, enabledCandidateIndices) {
      if (!summaries || summaries.length === 0) return;
      summaries.forEach((summary, idx) => {
        const yPos = enabledCandidateIndices[idx];
        const text = summary.totalDays > 0 ? summary.totalDays + 'd (max: ' + summary.longestStreakDays + 'd)' : '—';
        layout.annotations.push({
          xref: 'paper', yref: 'y' + (chartData.selectedFields.length + 1),
          x: 1.01, y: yPos, xanchor: 'left', yanchor: 'middle', text: text, showarrow: false,
          font: { size: 11, color: summary.totalDays > 0 ? summary.candidateColor : '#9ca3af' }
        });
      });
    }`;
  }

  // eslint-disable-next-line max-lines-per-function -- JS string generation
  private buildRenderFunctions(): string {
    return `
    function updateMetricsTable(enabledCandidates) {
      const rows = document.querySelectorAll('#metrics tbody tr');
      rows.forEach(row => {
        const candidateId = row.getAttribute('data-candidate-id');
        if (candidateId) row.style.display = enabledCandidates.includes(candidateId) ? '' : 'none';
      });
    }

    function buildSpiderTraces(enabledCandidates) {
      const traces = [];
      const axes = ['Shape', 'Tempo', 'Alignment', 'Shape'];
      const userTraj = chartData.trajectories[0];
      traces.push({ type: 'scatterpolar', r: [1, 1, 1, 1], theta: axes, fill: 'toself',
        fillcolor: userTraj.color + '10', mode: 'lines+markers', name: userTraj.label + ' (reference)',
        line: { color: userTraj.color, width: 2, dash: 'dash' }, marker: { size: 5, color: userTraj.color },
        hovertemplate: '%{theta}: 100%<extra>' + userTraj.label + '</extra>' });

      chartData.metrics.forEach((metric) => {
        if (!enabledCandidates.includes(metric.candidateId)) return;
        const traj = chartData.trajectories.find(t => t.id === metric.candidateId);
        if (!traj) return;
        const shape = metric.perField.position || 0;
        const tempo = metric.perField.domains || 0;
        const alignment = metric.perField.cityName || 0;
        traces.push({ type: 'scatterpolar', r: [shape, tempo, alignment, shape], theta: axes, fill: 'toself',
          fillcolor: traj.color + '18', mode: 'lines+markers', name: traj.label,
          line: { color: traj.color, width: 2 }, marker: { size: 6, color: traj.color },
          hovertemplate: '%{theta}: %{r:.0%}<extra>' + traj.label + '</extra>' });
      });
      return traces;
    }

    function renderSpiderChart(enabledCandidates) {
      if (chartData.mode !== 'full') return;
      const spiderEl = document.getElementById('spider-chart');
      if (!spiderEl) return;
      const traces = buildSpiderTraces(enabledCandidates);
      if (traces.length <= 1) {
        spiderEl.innerHTML = '<p style="color:#9ca3af;text-align:center;padding:20px;">No DTW data</p>';
        return;
      }
      const layout = {
        polar: {
          radialaxis: {
            visible: true, range: [0, 1], tickmode: 'array', tickvals: [0.25, 0.5, 0.75, 1],
            ticktext: ['25%', '50%', '75%', '100%'],
            tickfont: { size: 12, color: '#000', family: 'system-ui, sans-serif', weight: 700 },
            gridcolor: '#e5e7eb', linecolor: '#9ca3af', angle: 90
          },
          angularaxis: {
            tickfont: { size: 13, color: '#1f2937', weight: 600 }, gridcolor: '#d1d5db',
            rotation: 90, direction: 'clockwise'
          },
          bgcolor: '#f9fafb'
        },
        showlegend: true, legend: { x: 0.5, xanchor: 'center', y: -0.18, orientation: 'h', font: { size: 11 } },
        margin: { t: 20, b: 70, l: 50, r: 50 }, height: 350, dragmode: false
      };
      Plotly.newPlot('spider-chart', traces, layout, { responsive: true, displayModeBar: false, staticPlot: true });
    }

    function renderChart() {
      const fields = getSelectedFields();
      const enabledCandidates = getEnabledCandidates();
      const showConnectionLines = getShowConnectionLines();

      if (fields.length === 0) {
        document.getElementById('main-chart').innerHTML = '<p style="padding:40px;text-align:center;color:#6b7280;">Select at least one aspect</p>';
        return;
      }
      chartData.selectedFields = fields;

      const traces = buildAllTraces(fields, enabledCandidates);
      const goalLineTraces = buildGoalLineTraces(fields);
      const { layout, overlapAxisNum, overlapDomain } = buildLayout(fields, enabledCandidates);
      const overlapTraces = buildOverlapTraces(fields, 'y' + overlapAxisNum, enabledCandidates);
      const allTraces = [...traces, ...goalLineTraces, ...overlapTraces];

      if (showConnectionLines) layout.shapes = buildConnectionShapes(fields, enabledCandidates, overlapDomain);

      const goalMarkers = buildGoalMarkerShapesAndAnnotations(enabledCandidates);
      layout.shapes = [...(layout.shapes || []), ...goalMarkers.shapes];
      layout.annotations = [...(layout.annotations || []), ...goalMarkers.annotations];
      addOverlapAnnotations(layout, window.overlapSummaries, window.enabledCandidateIndices);

      Plotly.newPlot('main-chart', allTraces, layout, {
        responsive: true, displayModeBar: true, modeBarButtonsToRemove: ['lasso2d', 'select2d'],
        toImageButtonOptions: { format: 'png', filename: 'career-trajectory-comparison', height: 900, width: 1400, scale: 2 }
      });

      updateMetricsTable(enabledCandidates);
      renderSpiderChart(enabledCandidates);
    }`;
  }

  private buildEventHandlers(): string {
    return `
    document.querySelectorAll('#aspect-checkboxes input, #candidate-checkboxes input, #show-connection-lines').forEach(el => {
      el.addEventListener('change', renderChart);
    });

    document.getElementById('export-btn').addEventListener('click', () => {
      Plotly.downloadImage('main-chart', { format: 'png', width: 1400, height: 900, filename: 'career-trajectory-comparison', scale: 2 });
    });`;
  }
}
