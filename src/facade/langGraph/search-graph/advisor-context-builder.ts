import type { Goal, UserContext, WaymateCandidate } from "../../../shared/schemas.js";

type GoalCriteria = NonNullable<Goal["targetContext"]>;
type CriterionValue = { values: string[]; mode?: string } | null | undefined;

function formatGoalPart(name: string, criterion: CriterionValue): string | null {
  if (!criterion?.values.length) return null;
  return `${name}: ${criterion.values.join(", ")}`;
}

function formatDtwLine(c: WaymateCandidate): string | null {
  if (!c.dtwMetrics) return null;
  const { shapeSimilarity, tempoSimilarity, alignmentScore } = c.dtwMetrics;
  const total = c.dtwTotal?.toFixed(2) ?? "?";
  return `  DTW: shape=${shapeSimilarity.toFixed(2)}, tempo=${tempoSimilarity.toFixed(2)}, alignment=${alignmentScore.toFixed(2)} | total=${total}`;
}

function formatPathLine(c: WaymateCandidate): string | null {
  if (!c.path?.length) return null;
  return `  Path: ${c.path.map((p) => p.position).join(" → ")}`;
}

function formatTrailsLine(c: WaymateCandidate): string | null {
  if (!c.trails?.length) return null;
  return `  Trails: ${c.trails.map((t) => `${t.skill}@${t.platform}`).join(", ")}`;
}

function formatCandidateDetail(c: WaymateCandidate, index: number): string {
  const type = c.isWaymate ? " (waymate)" : "";
  const header = `#${index + 1}${type}: ${c.matchedContext.position} ${c.matchedContext.role}`;
  const feedback = c.matchedContext.feedback ? `  Feedback: "${c.matchedContext.feedback}"` : null;

  const lines = [header, formatDtwLine(c), feedback, formatPathLine(c), formatTrailsLine(c)].filter(
    (line): line is string => line !== null,
  );

  return lines.join("\n");
}

/**
 * Builds advisor context from trajectory, goal, and candidates.
 * Fluent API, optimized for token efficiency.
 */
export class AdvisorContextBuilder {
  private sections: string[] = [];

  addUserTrajectory(trajectory: UserContext[]): this {
    if (trajectory.length === 0) return this;

    const lines = trajectory.map(
      (ctx, i) =>
        `  ${i + 1}. ${ctx.position} | ${ctx.role} | ${ctx.domains.join(", ")} | ${ctx.skills.slice(0, 5).join(", ")}${ctx.skills.length > 5 ? "..." : ""}`,
    );

    this.sections.push(`USER TRAJECTORY (${trajectory.length}):\n${lines.join("\n")}`);
    return this;
  }

  addUserContext(ctx: UserContext | null): this {
    if (!ctx) return this;

    const line = `${ctx.position} | ${ctx.role} | ${ctx.domains.join(", ")} | ${ctx.skills.join(", ")}`;
    this.sections.push(`USER CONTEXT: ${line}`);
    return this;
  }

  addGoal(goal: Goal | null): this {
    if (!goal) return this;

    const g: GoalCriteria = goal.targetContext;
    const parts = [
      formatGoalPart("Position", g.position),
      formatGoalPart("Role", g.role),
      formatGoalPart("Domains", g.domains),
      formatGoalPart("Skills", g.skills),
      formatGoalPart("Countries", g.countries),
      formatGoalPart("Languages", g.languages),
    ].filter((p): p is string => p !== null);

    if (parts.length > 0) {
      this.sections.push(`GOAL: ${parts.join(" | ")}`);
    }
    return this;
  }

  addCandidates(candidates: WaymateCandidate[]): this {
    if (candidates.length === 0) return this;

    const lines = candidates.map((c, i) => {
      const type = c.isWaymate ? "[waymate]" : "";
      const dtw = c.dtwMetrics
        ? `DTW: ${c.dtwMetrics.shapeSimilarity.toFixed(2)}/${c.dtwMetrics.tempoSimilarity.toFixed(2)}/${c.dtwMetrics.alignmentScore.toFixed(2)}=${c.dtwTotal?.toFixed(2) ?? "?"}`
        : "";
      const ctx = c.matchedContext;
      const feedback = ctx.feedback ? ` — "${ctx.feedback}"` : "";

      return `  #${i + 1}${type} ${ctx.position} ${ctx.role} | ${ctx.skills.slice(0, 4).join(", ")} | ${dtw}${feedback}`;
    });

    this.sections.push(`CANDIDATES (${candidates.length}):\n${lines.join("\n")}`);
    return this;
  }

  addCandidateDetails(candidates: WaymateCandidate[]): this {
    if (candidates.length === 0) return this;

    const details = candidates.map((c, i) => formatCandidateDetail(c, i));
    this.sections.push(`CANDIDATE DETAILS:\n${details.join("\n\n")}`);
    return this;
  }

  addChart(url: string | null): this {
    if (!url) return this;
    this.sections.push(`CHART: ${url}`);
    return this;
  }

  build(): string {
    return this.sections.join("\n\n");
  }
}
