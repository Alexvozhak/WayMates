import type { ContextField } from "./schemas.js";
import type { DatabaseContext } from "../database-context.js";
import type { UserContext } from "../shared/schemas.js";
import type { ManagedTransaction, Plan } from "neo4j-driver";

type SelectivityResult = {
  fieldName: ContextField;
  estimatedRows: number;
};

const FALLBACK_SELECTIVITY = 1_000_000;

export class SelectivityService {
  private readonly explainPatterns: Record<ContextField, string> = {
    position: 'MATCH (c:Context {position: $fieldValue})',
    domains: 'MATCH (c:Context) WHERE ANY(d IN $fieldValue WHERE d IN c.domains)',
    skills: 'MATCH (c:Context) WHERE ANY(s IN $fieldValue WHERE s IN c.skills)',
    industry: 'MATCH (c:Context {industry: $fieldValue})',
    companySize: 'MATCH (c:Context {companySize: $fieldValue})',
    countryCode: 'MATCH (c:Context {countryCode: $fieldValue})',
    cityName: 'MATCH (c:Context {cityName: $fieldValue})',
    birthYear: 'MATCH (c:Context {birthYear: $fieldValue})',
    educationLevel: 'MATCH (c:Context {educationLevel: $fieldValue})',
    languages: 'MATCH (c:Context)-[:SPEAKS_FLUENT]->(l:Language) WHERE l.code IN $fieldValue',
  };

  constructor(private db: DatabaseContext) {}

  async rankStrictFields(
    strictFields: ContextField[],
    userContext: UserContext
  ): Promise<ContextField[]> {
    const results = await this.db.read(async (tx) => {
      const selectivityResults: SelectivityResult[] = [];

      for (const fieldName of strictFields) {
        const fieldValue = this.getContextFieldValue(userContext, fieldName);
        if (fieldValue == null) continue;

        try {
          const result = await this.getFieldSelectivity(
            tx,
            fieldName,
            fieldValue
          );
          selectivityResults.push(result);
        } catch {
          // swallow, continue to next field
        }
      }

      return selectivityResults;
    });

    if (results.length === 0) return strictFields;

    return results
      .toSorted((a, b) => a.estimatedRows - b.estimatedRows)
      .map((r) => r.fieldName);
  }

  private getContextFieldValue(context: UserContext, field: ContextField): unknown {
    const fieldMap: Record<ContextField, unknown> = {
      position: context.position,
      domains: context.domains,
      skills: context.skills,
      industry: context.industry,
      companySize: context.companySize,
      countryCode: context.countryCode,
      cityName: context.cityName,
      birthYear: context.birthYear,
      educationLevel: context.educationLevel,
      languages: context.languages,
    };
    return fieldMap[field];
  }

  private buildExplainPattern(fieldName: ContextField): string {
    return this.explainPatterns[fieldName];
  }

  private async getFieldSelectivity(
    tx: ManagedTransaction,
    fieldName: ContextField,
    fieldValue: unknown
  ): Promise<SelectivityResult> {
    const pattern = this.buildExplainPattern(fieldName);
    const query = `EXPLAIN ${pattern} RETURN count(c)`;

    try {
      const result = await tx.run(query, { fieldValue });
      const estimatedRows = this.isPlanWithEstimatedRows(result.summary?.plan)
        ? Number.parseInt(result.summary.plan.arguments.EstimatedRows, 10)
        : FALLBACK_SELECTIVITY;

      return { fieldName, estimatedRows };
    } catch {
      return { fieldName, estimatedRows: FALLBACK_SELECTIVITY };
    }
  }

  private isPlanWithEstimatedRows(plan: unknown): plan is Plan & {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    arguments: { EstimatedRows: string };
  } {
    return (
      plan !== null &&
      typeof plan === "object" &&
      "arguments" in plan &&
      plan.arguments !== null &&
      typeof plan.arguments === "object" &&
      "EstimatedRows" in plan.arguments &&
      typeof plan.arguments.EstimatedRows === "string"
    );
  }
}
