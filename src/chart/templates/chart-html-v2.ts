/**
 * Chart HTML Generator v2
 *
 * Features:
 * - Overlap Timeline integrated as Plotly subplot (aligned with X-axis)
 * - Candidate toggle checkboxes
 * - Connection lines toggle (vertical lines from overlap to aspects)
 * - Enhanced hover tooltips
 * - Export PNG button
 * - Dynamic recalculation on Apply click
 * - English interface
 */

import type { ChartableField, Locale, OverlapSummary, ProcessedTrajectory, SimilarityMetrics } from "../types.js";

export type ChartPageDataV2 = {
  trajectories: ProcessedTrajectory[];
  fields: ChartableField[];
  selectedFields: ChartableField[];
  metrics: SimilarityMetrics[];
  overlapSummaries: OverlapSummary[];
  timeRange: { minTime: number; maxTime: number };
  locale: Locale;
};

/**
 * Build CSS styles for chart page v2.
 */
function buildStyles(): string {
  return `<style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 1400px; margin: 0 auto; padding: 20px; background: #f9fafb; }
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
    .options-group { display: flex; align-items: center; gap: 15px; padding-bottom: 5px; }
    .options-group label { font-size: 13px; color: #4b5563; }
    #main-chart { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 20px; }
    #metrics { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    #metrics table { width: 100%; border-collapse: collapse; }
    #metrics th, #metrics td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    #metrics th { background: #f3f4f6; font-weight: 600; }
  </style>`;
}

/**
 * Build field config and trace builders JavaScript.
 */
// eslint-disable-next-line max-lines-per-function
function buildTraceFunctions(): string {
  return `
    const GOAL_STAR_COLOR = '#fbbf24';
    const MS_PER_DAY = 86400000;

    function getFieldConfig(field) {
      const configs = {
        position: { label: 'Grade', levels: ['junior', 'middle', 'senior', 'lead'] },
        domains: { label: 'Domain', levels: [] },
        cityName: { label: 'City', levels: [] },
        industry: { label: 'Industry', levels: [] },
        salaryExact: { label: 'Salary', levels: [] }
      };
      return configs[field] || { label: field, levels: [] };
    }

    function buildTracesForField(field, xaxisId, yaxisId, enabledCandidates) {
      const traces = [];
      const config = getFieldConfig(field);
      const levels = config.levels;

      for (const traj of chartData.trajectories) {
        // Skip disabled candidates (but always show user)
        if (traj.candidateType !== null && !enabledCandidates.includes(traj.id)) {
          continue;
        }

        const x = traj.points.map(p => new Date(p.timestamp));
        const rawValues = traj.points.map(p => p.values[field]);
        const y = levels.length > 0 ? rawValues.map(v => v === null ? null : levels.indexOf(v)) : rawValues;
        const text = rawValues.map(v => v === null ? '—' : String(v));
        const hasMatchedContext = traj.matchedContextIndex !== undefined && traj.matchedContextIndex >= 0;

        if (hasMatchedContext && traj.candidateType === 'pathfinder') {
          const matchedIdx = traj.matchedContextIndex;
          if (matchedIdx > 0) {
            traces.push({
              x: x.slice(0, matchedIdx + 1),
              y: y.slice(0, matchedIdx + 1),
              text: text.slice(0, matchedIdx + 1),
              mode: 'lines+markers',
              name: traj.label + ' (path to goal)',
              line: { color: traj.color, width: traj.width, shape: 'hv' },
              marker: { size: 6, color: traj.color },
              legendgroup: traj.label,
              showlegend: field === chartData.selectedFields[0],
              hovertemplate: '<b>%{text}</b><br>%{x|%Y-%m-%d}<extra>' + traj.label + '</extra>',
              xaxis: xaxisId,
              yaxis: yaxisId
            });
          }
          traces.push({
            x: [x[matchedIdx]],
            y: [y[matchedIdx]],
            mode: 'markers',
            name: traj.label + ' ⭐',
            marker: { symbol: 'star', size: 20, color: GOAL_STAR_COLOR, line: { color: traj.color, width: 2 } },
            legendgroup: traj.label,
            showlegend: false,
            hovertemplate: '🎯 Goal reached<br>%{x|%Y-%m-%d}<extra></extra>',
            xaxis: xaxisId,
            yaxis: yaxisId
          });
          if (matchedIdx < x.length - 1) {
            traces.push({
              x: x.slice(matchedIdx),
              y: y.slice(matchedIdx),
              text: text.slice(matchedIdx),
              mode: 'lines+markers',
              name: traj.label + ' (after)',
              line: { color: traj.color, width: traj.width, shape: 'hv' },
              marker: { size: 6, color: traj.color },
              opacity: 0.4,
              legendgroup: traj.label,
              showlegend: false,
              hovertemplate: '<b>%{text}</b><br>%{x|%Y-%m-%d}<extra>' + traj.label + '</extra>',
              xaxis: xaxisId,
              yaxis: yaxisId
            });
          }
        } else {
          const badge = traj.candidateType === 'waymate' ? ' (Waymate)' : traj.candidateType === 'pathfinder' ? ' (Pathfinder)' : '';
          traces.push({
            x: x,
            y: y,
            text: text,
            mode: 'lines+markers',
            name: traj.label + badge,
            line: { color: traj.color, width: traj.width, shape: 'hv' },
            marker: { size: 6, color: traj.color },
            legendgroup: traj.label,
            showlegend: field === chartData.selectedFields[0],
            hovertemplate: '<b>%{text}</b><br>%{x|%Y-%m-%d}<extra>' + traj.label + '</extra>',
            xaxis: xaxisId,
            yaxis: yaxisId
          });
        }
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
    }`;
}

/**
 * Build overlap calculation and traces JavaScript.
 */
// eslint-disable-next-line max-lines-per-function
function buildOverlapFunctions(): string {
  return `
    // Find per-field overlap periods between user and candidate
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
          const candValue = candPoint.values[field];
          if (candValue !== userValue) continue;

          const overlapStart = Math.max(userPoint.timestamp, candPoint.timestamp);
          const overlapEnd = Math.min(userNext.timestamp, candNext.timestamp);
          if (overlapStart < overlapEnd) {
            overlaps.push({ start: overlapStart, end: overlapEnd });
          }
        }
      }
      return overlaps;
    }

    // Intersect two interval arrays
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

    // Find full overlap periods (ALL selected fields match)
    function findFullOverlaps(userTraj, candTraj, fields) {
      if (fields.length === 0) return [];

      let result = findFieldOverlaps(userTraj.points, candTraj.points, fields[0]);
      for (let i = 1; i < fields.length; i++) {
        const next = findFieldOverlaps(userTraj.points, candTraj.points, fields[i]);
        result = intersectIntervals(result, next);
        if (result.length === 0) break;
      }
      return result;
    }

    // Calculate overlap summary for display
    function calculateOverlapSummary(candTraj, periods) {
      let totalMs = 0;
      let longestMs = 0;
      for (const p of periods) {
        const dur = p.end - p.start;
        totalMs += dur;
        if (dur > longestMs) longestMs = dur;
      }
      return {
        candidateId: candTraj.id,
        candidateLabel: candTraj.label,
        candidateColor: candTraj.color,
        periods: periods,
        totalDays: Math.round(totalMs / MS_PER_DAY),
        longestStreakDays: Math.round(longestMs / MS_PER_DAY)
      };
    }

    // Build overlap traces for Plotly subplot
    function buildOverlapTraces(fields, overlapYaxisId, enabledCandidates) {
      const traces = [];
      const userTraj = chartData.trajectories[0];
      const candidates = chartData.trajectories.slice(1).filter(c => enabledCandidates.includes(c.id));
      const summaries = [];

      candidates.forEach((cand, idx) => {
        const periods = findFullOverlaps(userTraj, cand, fields);
        const summary = calculateOverlapSummary(cand, periods);
        summaries.push(summary);

        // Create horizontal bar trace for each period
        periods.forEach((period) => {
          // Overlap bar (horizontal segment)
          traces.push({
            x: [new Date(period.start), new Date(period.end)],
            y: [idx, idx],
            mode: 'lines',
            line: { color: cand.color, width: 10 },
            opacity: 0.8,
            showlegend: false,
            hovertemplate: cand.label + ': ' + Math.round((period.end - period.start) / MS_PER_DAY) + ' days<extra></extra>',
            xaxis: 'x',
            yaxis: overlapYaxisId
          });
        });
      });

      // Store summaries for annotations and shapes
      window.overlapSummaries = summaries;
      window.enabledCandidateIndices = candidates.map((_, i) => i);
      return traces;
    }

    // Build connection line shapes (vertical lines from overlap bar to top of chart)
    function buildConnectionShapes(fields, enabledCandidates, overlapDomain) {
      const shapes = [];
      const userTraj = chartData.trajectories[0];
      const candidates = chartData.trajectories.slice(1).filter(c => enabledCandidates.includes(c.id));
      const numCandidates = candidates.length;
      if (numCandidates === 0) return shapes;

      // Calculate paper y coordinate for each candidate's overlap bar
      // Plotly categorical axis with n items uses range roughly [-0.5, n-0.5]
      // But there's also padding, so we calculate based on actual domain
      const domainHeight = overlapDomain[1] - overlapDomain[0];
      // Each candidate gets equal vertical space within the domain
      const slotHeight = domainHeight / numCandidates;

      candidates.forEach((cand, idx) => {
        const periods = findFullOverlaps(userTraj, cand, fields);

        // Paper y is at the center of this candidate's slot
        // idx=0 is at bottom, idx=n-1 is at top
        const yPaper = overlapDomain[0] + (idx + 0.5) * slotHeight;

        periods.forEach((period) => {
          // Left edge vertical line (from overlap bar to top of chart)
          shapes.push({
            type: 'line',
            x0: period.start,
            x1: period.start,
            y0: yPaper,
            y1: 0.95,
            xref: 'x',
            yref: 'paper',
            line: { color: cand.color, width: 1, dash: 'dot' },
            opacity: 0.35
          });
          // Right edge vertical line
          shapes.push({
            type: 'line',
            x0: period.end,
            x1: period.end,
            y0: yPaper,
            y1: 0.95,
            xref: 'x',
            yref: 'paper',
            line: { color: cand.color, width: 1, dash: 'dot' },
            opacity: 0.35
          });
        });
      });

      return shapes;
    }`;
}

/**
 * Build layout generator JavaScript.
 */
// eslint-disable-next-line max-lines-per-function
function buildLayoutFunction(title: string): string {
  return `
    function buildLayout(fields, enabledCandidates) {
      const numFields = fields.length;
      const candidates = chartData.trajectories.slice(1).filter(c => enabledCandidates.includes(c.id));
      const overlapHeight = candidates.length > 0 ? 0.10 + candidates.length * 0.03 : 0.12;
      const chartAreaTop = 0.95;
      const chartAreaBottom = overlapHeight + 0.05;
      const chartHeight = chartAreaTop - chartAreaBottom;
      const subplotHeight = chartHeight / numFields;
      const gap = 0.015;

      const layout = {
        title: { text: '${title}', font: { size: 18 } },
        showlegend: true,
        legend: { x: 1.02, y: 1, xanchor: 'left' },
        hovermode: 'closest',
        height: 300 + numFields * 160 + Math.max(candidates.length, 2) * 40,
        margin: { r: 150, t: 60 },
        annotations: [],
        shapes: []
      };

      // Field subplots
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
        layout[xaxisKey] = {
          type: 'date',
          anchor: index === 0 ? 'y' : 'y' + (index + 1),
          showticklabels: false
        };
      });

      // Overlap timeline subplot
      const overlapAxisNum = numFields + 1;
      const overlapYaxisKey = 'yaxis' + overlapAxisNum;
      const candidateLabels = candidates.map(t => t.label);

      layout[overlapYaxisKey] = {
        title: { text: 'Overlap', font: { size: 12 } },
        domain: [0.02, overlapHeight],
        anchor: 'x',
        tickmode: 'array',
        tickvals: candidateLabels.map((_, i) => i),
        ticktext: candidateLabels,
        tickfont: { size: 11 },
        fixedrange: true,
        gridcolor: '#e5e7eb'
      };

      // X axis (shared, at bottom with labels)
      layout.xaxis = layout.xaxis || {};
      layout.xaxis.title = { text: 'Date', font: { size: 12 } };
      layout.xaxis.showticklabels = true;
      layout.xaxis.tickfont = { size: 10 };

      // Return overlap domain for connection lines calculation
      const overlapDomain = [0.02, overlapHeight];
      return { layout, overlapAxisNum, overlapDomain };
    }

    function addOverlapAnnotations(layout, summaries, enabledCandidateIndices) {
      if (!summaries || summaries.length === 0) return;

      summaries.forEach((summary, idx) => {
        const yPos = enabledCandidateIndices[idx];
        const text = summary.totalDays > 0
          ? summary.totalDays + 'd (max: ' + summary.longestStreakDays + 'd)'
          : '—';

        layout.annotations.push({
          xref: 'paper',
          yref: 'y' + (chartData.selectedFields.length + 1),
          x: 1.01,
          y: yPos,
          xanchor: 'left',
          yanchor: 'middle',
          text: text,
          showarrow: false,
          font: { size: 11, color: summary.totalDays > 0 ? summary.candidateColor : '#9ca3af' }
        });
      });
    }`;
}

/**
 * Build render and event handling JavaScript.
 */
// eslint-disable-next-line max-lines-per-function
function buildRenderFunction(): string {
  return `
    function getSelectedFields() {
      return Array.from(document.querySelectorAll('#aspect-checkboxes input:checked')).map(input => input.value);
    }

    function getEnabledCandidates() {
      return Array.from(document.querySelectorAll('#candidate-checkboxes input:checked')).map(input => input.value);
    }

    function getShowConnectionLines() {
      const checkbox = document.getElementById('show-connection-lines');
      return checkbox ? checkbox.checked : false;
    }

    function updateMetricsTable(enabledCandidates) {
      const rows = document.querySelectorAll('#metrics tbody tr');
      rows.forEach(row => {
        const candidateId = row.getAttribute('data-candidate-id');
        if (candidateId) {
          row.style.display = enabledCandidates.includes(candidateId) ? '' : 'none';
        }
      });
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

      // Build layout first to get overlapAxisNum and overlapDomain
      const { layout, overlapAxisNum, overlapDomain } = buildLayout(fields, enabledCandidates);
      const overlapYaxisId = 'y' + overlapAxisNum;

      // Build overlap traces
      const overlapTraces = buildOverlapTraces(fields, overlapYaxisId, enabledCandidates);

      // Combine traces
      const allTraces = [...traces, ...overlapTraces];

      // Add connection line shapes if enabled
      if (showConnectionLines) {
        layout.shapes = buildConnectionShapes(fields, enabledCandidates, overlapDomain);
      }

      // Add annotations for overlap stats
      addOverlapAnnotations(layout, window.overlapSummaries, window.enabledCandidateIndices);

      Plotly.newPlot('main-chart', allTraces, layout, {
        responsive: true,
        displayModeBar: true,
        modeBarButtonsToRemove: ['lasso2d', 'select2d'],
        toImageButtonOptions: {
          format: 'png',
          filename: 'career-trajectory-comparison',
          height: 900,
          width: 1400,
          scale: 2
        }
      });

      // Update metrics table visibility
      updateMetricsTable(enabledCandidates);
    }

    // Auto-recalculate on any checkbox change (no Apply button needed)
    document.querySelectorAll('#aspect-checkboxes input, #candidate-checkboxes input, #show-connection-lines').forEach(el => {
      el.addEventListener('change', renderChart);
    });

    // Export PNG button
    document.getElementById('export-btn').addEventListener('click', () => {
      Plotly.downloadImage('main-chart', {
        format: 'png',
        width: 1400,
        height: 900,
        filename: 'career-trajectory-comparison',
        scale: 2
      });
    });

    // Initial render
    renderChart();`;
}

/**
 * Build complete JavaScript for chart interactions.
 */
function buildScript(data: ChartPageDataV2, title: string): string {
  return `<script>
    const chartData = ${JSON.stringify(data)};
    ${buildTraceFunctions()}
    ${buildOverlapFunctions()}
    ${buildLayoutFunction(title)}
    ${buildRenderFunction()}
  </script>`;
}

/**
 * Render metrics table with candidate IDs for filtering.
 */
function renderMetricsTableV2(metrics: SimilarityMetrics[], trajectories: ProcessedTrajectory[]): string {
  const headers = ["#", "Type", "Shape", "Tempo", "Stability", "Total"];
  const sortedMetrics = metrics.toSorted((a, b) => b.overall - a.overall);

  const rows = sortedMetrics
    .map((metric) => {
      const traj = trajectories.find((t) => t.id === metric.candidateId);
      if (!traj) return "";

      const typeLabelMap: Record<string, string> = { pathfinder: "Pathfinder", waymate: "Waymate" };
      const typeLabel = metric.candidateType ? (typeLabelMap[metric.candidateType] ?? "—") : "—";
      const shape = metric.perField.position ? `${Math.round(metric.perField.position * 100)}%` : "—";
      const tempo = metric.perField.domains ? `${Math.round(metric.perField.domains * 100)}%` : "—";
      const stability = metric.perField.cityName ? `${Math.round(metric.perField.cityName * 100)}%` : "—";
      const total = metric.overall > 0 ? metric.overall.toFixed(2) : "—";

      return `
        <tr data-candidate-id="${metric.candidateId}">
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
      <h4>📊 Trajectory Similarity Metrics</h4>
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
 * Build controls HTML with all options.
 */
// eslint-disable-next-line max-lines-per-function
function buildControlsV2(
  fields: ChartableField[],
  selected: ChartableField[],
  trajectories: ProcessedTrajectory[],
): string {
  const fieldLabels: Record<ChartableField, string> = {
    position: "Grade",
    domains: "Domain",
    cityName: "City",
    industry: "Industry",
    salaryExact: "Salary",
  };

  const aspectCheckboxes = fields
    .map((field) => {
      const label = fieldLabels[field];
      const checked = selected.includes(field) ? "checked" : "";
      return `<label><input type="checkbox" value="${field}" ${checked}> ${label}</label>`;
    })
    .join("\n            ");

  const candidates = trajectories.slice(1);
  const candidateCheckboxes = candidates
    .map((traj) => {
      const badge = traj.candidateType === "pathfinder" ? "Pathfinder" : "Waymate";
      return `<label>
              <input type="checkbox" value="${traj.id}" checked>
              <span class="candidate-label" style="background:${traj.color};"></span>
              ${traj.label} (${badge})
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

/**
 * Build complete HTML template.
 */
function buildHtmlTemplate(
  title: string,
  controls: string,
  metricsTable: string,
  data: ChartPageDataV2,
  locale: Locale,
): string {
  const styles = buildStyles();
  const script = buildScript(data, title);
  return `<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <script src="https://cdn.plot.ly/plotly-2.27.0.min.js"></script>
  ${styles}
</head>
<body>
  ${controls}
  <div id="main-chart"></div>
  ${metricsTable}
  ${script}
</body>
</html>`;
}

/**
 * Generate complete HTML page with Plotly chart v2.
 * - Overlap Timeline integrated as subplot
 * - Candidate toggle checkboxes
 * - Connection lines toggle
 * - Export PNG button
 * - Dynamic recalculation on Apply
 * - English interface
 */
export function generateChartHtmlV2(data: ChartPageDataV2): string {
  const { trajectories, fields, selectedFields, metrics, locale } = data;

  const title = "Career Trajectory Comparison";
  const controls = buildControlsV2(fields, selectedFields, trajectories);
  const metricsTable = metrics.length > 0 ? renderMetricsTableV2(metrics, trajectories) : "";

  return buildHtmlTemplate(title, controls, metricsTable, data, locale);
}
