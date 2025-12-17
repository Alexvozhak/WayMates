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
 * Build JavaScript for chart interactions.
 */
function buildScript(data: ChartPageData, title: string): string {
  return `<script>
    const chartData = ${JSON.stringify(data)};

    function renderChart() {
      const traces = [];
      // TODO: Build Plotly traces from trajectories
      const layout = {
        title: '${title}',
        showlegend: true,
        hovermode: 'closest'
      };
      Plotly.newPlot('main-chart', traces, layout);
    }

    document.getElementById('apply-btn').addEventListener('click', () => {
      const selected = Array.from(document.querySelectorAll('.checkboxes input:checked'))
        .map(input => input.value);
      // TODO: Filter and re-render chart
      renderChart();
    });

    renderChart();
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
