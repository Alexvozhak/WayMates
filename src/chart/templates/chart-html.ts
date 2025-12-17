import { renderControls, renderMetricsTable } from "./template-parts.js";

import type { ChartableField, Locale, ProcessedTrajectory, SimilarityMetrics } from "../types.js";

export type ChartPageData = {
  trajectories: ProcessedTrajectory[];
  fields: ChartableField[];
  selectedFields: ChartableField[];
  metrics: SimilarityMetrics[];
  locale: Locale;
};

/**
 * Build CSS styles for chart page.
 */
function buildStyles(): string {
  return `<style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; background: #f9fafb; }
    #controls { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .checkboxes { display: flex; gap: 15px; flex-wrap: wrap; margin: 15px 0; }
    .checkboxes label { display: flex; align-items: center; gap: 8px; cursor: pointer; }
    #apply-btn { background: #3b82f6; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 14px; }
    #apply-btn:hover { background: #2563eb; }
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
 
function buildTraceFunctions(): string {
  return `const GOAL_STAR_COLOR = '#fbbf24';
    function getFieldConfig(field) {
      const configs = { position: { label: 'Грейд', levels: ['junior', 'middle', 'senior', 'lead'] }, domains: { label: 'Домен', levels: [] }, cityName: { label: 'Город', levels: [] }, industry: { label: 'Индустрия', levels: [] }, salaryExact: { label: 'Зарплата', levels: [] } };
      return configs[field] || { label: field, levels: [] };
    }
    function buildTracesForField(field, xaxisId, yaxisId) {
      const traces = []; const config = getFieldConfig(field); const levels = config.levels;
      for (const traj of chartData.trajectories) {
        const x = traj.points.map(p => new Date(p.timestamp)); const rawValues = traj.points.map(p => p.values[field]); const y = levels.length > 0 ? rawValues.map(v => v === null ? null : levels.indexOf(v)) : rawValues; const hasMatchedContext = traj.matchedContextIndex !== undefined && traj.matchedContextIndex >= 0;
        if (hasMatchedContext && traj.candidateType === 'pathfinder') {
          const matchedIdx = traj.matchedContextIndex;
          if (matchedIdx > 0) { traces.push({ x: x.slice(0, matchedIdx + 1), y: y.slice(0, matchedIdx + 1), mode: 'lines+markers', name: traj.label + ' (путь к цели)', line: { color: traj.color, width: traj.width, shape: 'hv' }, marker: { size: 6, color: traj.color }, legendgroup: traj.label, showlegend: field === chartData.selectedFields[0], xaxis: xaxisId, yaxis: yaxisId }); }
          traces.push({ x: [x[matchedIdx]], y: [y[matchedIdx]], mode: 'markers', name: traj.label + ' ⭐', marker: { symbol: 'star', size: 20, color: GOAL_STAR_COLOR, line: { color: traj.color, width: 2 } }, legendgroup: traj.label, showlegend: false, hovertemplate: '🎯 Достиг цели<br>%{x|%Y-%m-%d}<extra></extra>', xaxis: xaxisId, yaxis: yaxisId });
          if (matchedIdx < x.length - 1) { traces.push({ x: x.slice(matchedIdx), y: y.slice(matchedIdx), mode: 'lines+markers', name: traj.label + ' (после)', line: { color: traj.color, width: traj.width, shape: 'hv' }, marker: { size: 6, color: traj.color }, opacity: 0.4, legendgroup: traj.label, showlegend: false, xaxis: xaxisId, yaxis: yaxisId }); }
        } else {
          const badge = traj.candidateType === 'waymate' ? ' (Waymate)' : traj.candidateType === 'pathfinder' ? ' (Pathfinder)' : '';
          traces.push({ x: x, y: y, mode: 'lines+markers', name: traj.label + badge, line: { color: traj.color, width: traj.width, shape: 'hv' }, marker: { size: 6, color: traj.color }, legendgroup: traj.label, showlegend: field === chartData.selectedFields[0], xaxis: xaxisId, yaxis: yaxisId });
        }
      }
      return traces;
    }
    function buildAllTraces(fields) {
      const allTraces = []; fields.forEach((field, index) => { const xaxisId = index === 0 ? 'x' : 'x' + (index + 1); const yaxisId = index === 0 ? 'y' : 'y' + (index + 1); allTraces.push(...buildTracesForField(field, xaxisId, yaxisId)); });
      return allTraces;
    }`;
}

/**
 * Build layout generator JavaScript.
 */
function buildLayoutFunction(title: string): string {
  return `
    function buildLayout(fields) {
      const numFields = fields.length;
      const subplotHeight = 0.85 / numFields;
      const gap = 0.05 / Math.max(numFields - 1, 1);
      const layout = { title: '${title}', showlegend: true, hovermode: 'closest', height: 300 + numFields * 200 };

      fields.forEach((field, index) => {
        const config = getFieldConfig(field);
        const yaxisKey = index === 0 ? 'yaxis' : 'yaxis' + (index + 1);
        const xaxisKey = index === 0 ? 'xaxis' : 'xaxis' + (index + 1);
        const domainTop = 0.95 - index * (subplotHeight + gap);
        const domainBottom = domainTop - subplotHeight;

        layout[yaxisKey] = {
          title: config.label, domain: [domainBottom, domainTop], anchor: index === 0 ? 'x' : 'x' + (index + 1),
          tickmode: config.levels.length > 0 ? 'array' : 'auto',
          tickvals: config.levels.length > 0 ? config.levels.map((_, i) => i) : undefined,
          ticktext: config.levels.length > 0 ? config.levels : undefined,
        };
        layout[xaxisKey] = {
          title: index === numFields - 1 ? (chartData.locale === 'ru' ? 'Дата' : 'Date') : '',
          type: 'date', anchor: index === 0 ? 'y' : 'y' + (index + 1),
        };
      });
      return layout;
    }`;
}

/**
 * Build render and event handling JavaScript.
 */
function buildRenderFunction(): string {
  return `
    function renderChart(selectedFields) {
      const fields = selectedFields && selectedFields.length > 0 ? selectedFields : chartData.selectedFields;
      const traces = buildAllTraces(fields);
      const layout = buildLayout(fields);
      Plotly.newPlot('main-chart', traces, layout);
    }

    document.getElementById('apply-btn').addEventListener('click', () => {
      const selected = Array.from(document.querySelectorAll('.checkboxes input:checked')).map(input => input.value);
      renderChart(selected);
    });

    renderChart();`;
}

/**
 * Build complete JavaScript for chart interactions.
 */
function buildScript(data: ChartPageData, title: string): string {
  return `<script>
    const chartData = ${JSON.stringify(data)};
    ${buildTraceFunctions()}
    ${buildLayoutFunction(title)}
    ${buildRenderFunction()}
  </script>`;
}

/**
 * Build complete HTML template.
 */
function buildHtmlTemplate(
  title: string,
  controls: string,
  metricsTable: string,
  data: ChartPageData,
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
 * Generate complete HTML page with Plotly chart.
 */
export function generateChartHtml(data: ChartPageData): string {
  const { trajectories, fields, selectedFields, metrics, locale } = data;

  const title = locale === "ru" ? "Сравнение карьерных траекторий" : "Career Trajectory Comparison";
  const controls = renderControls(fields, selectedFields, locale);
  const metricsTable = metrics.length > 0 ? renderMetricsTable(metrics, trajectories, locale) : "";

  return buildHtmlTemplate(title, controls, metricsTable, data, locale);
}
