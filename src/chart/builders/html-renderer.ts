import { readFileSync } from "node:fs";
import path from "node:path";

import { GOAL_STAR_COLOR } from "../config/colors.js";
import { CANDIDATE_BADGE, CANDIDATE_LABEL } from "../types.js";

import type {
  ChartableField,
  ChartLocale,
  ChartMode,
  DynamicLevels,
  GoalValues,
  OverlapSummary,
  ProcessedTrajectory,
  SimilarityMetrics,
} from "../types.js";

// Browser runtime — compiled by esbuild, read once at module load
const CHART_RUNTIME_JS = readFileSync(path.join(process.cwd(), "dist/chart/browser/chart-runtime.js"), "utf8");

export type ChartRenderData = {
  mode: ChartMode;
  trajectories: ProcessedTrajectory[];
  fields: ChartableField[];
  metrics: SimilarityMetrics[];
  overlapSummaries: OverlapSummary[];
  timeRange: { minTime: number; maxTime: number };
  locale: ChartLocale;
  goalValues: GoalValues;
  dynamicLevels: DynamicLevels;
  excludedOverlapFields: ChartableField[];
};

const FIELD_LABELS: Record<ChartLocale, Record<ChartableField, string>> = {
  en: {
    position: "Grade",
    role: "Role",
    domains: "Domain",
    countryCode: "Country",
    cityName: "City",
    industry: "Industry",
    salaryExact: "Salary (USD)",
  },
  ru: {
    position: "Грейд",
    role: "Роль",
    domains: "Домен",
    countryCode: "Страна",
    cityName: "Город",
    industry: "Индустрия",
    salaryExact: "Зарплата (USD)",
  },
};

const GOAL_LABELS: Record<ChartLocale, { name: string; hover: string }> = {
  en: { name: "Your goal", hover: "Goal" },
  ru: { name: "Ваша цель", hover: "Цель" },
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
  <div id="main-chart-container">
    <div id="main-chart"></div>
  </div>
  ${this.buildMetricsSection()}
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
    #main-chart { width: 100%; }
    #main-chart-container { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 20px; overflow: visible; }
    #metrics-row { display: flex; gap: 20px; align-items: flex-start; }
    #metrics { flex: 1; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    #metrics h4 { margin: 0 0 15px 0; font-size: 14px; color: #374151; }
    #metrics table { width: 100%; border-collapse: collapse; }
    #metrics th, #metrics td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    #metrics th { background: #f3f4f6; font-weight: 600; }
    #spider-chart-container { width: 380px; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    #spider-chart-container h4 { margin: 0 0 10px 0; font-size: 14px; color: #374151; }
  </style>`;
  }

  private buildControls(): string {
    const labels = FIELD_LABELS[this.data.locale];
    const aspectCheckboxes = this.data.fields
      .map((field) => {
        const label = labels[field];
        return `<label><input type="checkbox" value="${field}" checked> ${label}</label>`;
      })
      .join("\n            ");

    const candidates = this.data.trajectories.slice(1);
    const candidateCheckboxes = candidates
      .map((traj) => {
        const badge = traj.candidateType ? CANDIDATE_BADGE[traj.candidateType] : "";
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

  private buildMetricsSection(): string {
    if (!this.hasDtwData) return "";

    const showSpider = this.data.mode === "full";
    const spiderHtml = showSpider
      ? `<div id="spider-chart-container">
        <h4>DTW Similarity</h4>
        <div id="spider-chart"></div>
      </div>`
      : "";

    const headers = ["#", "Type", "Shape", "Tempo", "Alignment", "Total"];
    const sortedMetrics = this.data.metrics.toSorted((a, b) => b.overall - a.overall);

    const rows = sortedMetrics
      .map((metric) => {
        const traj = this.data.trajectories.find((t) => t.id === metric.candidateId);
        if (!traj) return "";

        const typeLabel = metric.candidateType ? CANDIDATE_LABEL[metric.candidateType] : "—";
        const shape = metric.perField.position ? `${Math.round(metric.perField.position * 100)}%` : "—";
        const tempo = metric.perField.domains ? `${Math.round(metric.perField.domains * 100)}%` : "—";
        const alignment = metric.perField.cityName ? `${Math.round(metric.perField.cityName * 100)}%` : "—";
        const totalPercent = metric.overall > 0 ? `${Math.round((metric.overall / 3) * 100)}%` : "—";
        const totalSum = metric.overall > 0 ? `(${metric.overall.toFixed(2)}/3.00)` : "";

        return `
        <tr data-candidate-id="${metric.candidateId}">
          <td>${traj.label}</td>
          <td>${typeLabel}</td>
          <td>${shape}</td>
          <td>${tempo}</td>
          <td>${alignment}</td>
          <td><strong>${totalPercent}</strong> <span style="color:#9ca3af;font-size:12px;">${totalSum}</span></td>
        </tr>`;
      })
      .join("\n");

    return `
    <div id="metrics-row">
      <div id="metrics">
        <h4>Trajectory Similarity Metrics</h4>
        <table>
          <thead>
            <tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      ${spiderHtml}
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
      excludedOverlapFields: this.data.excludedOverlapFields,
    });

    const labelsJson = JSON.stringify(FIELD_LABELS[this.data.locale]);
    const goalLabelsJson = JSON.stringify(GOAL_LABELS[this.data.locale]);

    return `<script>
    const chartData = ${chartDataJson};
    const GOAL_STAR_COLOR = '${GOAL_STAR_COLOR}';
    const fieldLabels = ${labelsJson};
    const goalLabels = ${goalLabelsJson};

    ${CHART_RUNTIME_JS}

    // Initialize chart
    ChartRuntime.initChart('${this.title}');
  </script>`;
  }
}
