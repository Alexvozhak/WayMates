import type { ManagedTransaction, Plan } from "neo4j-driver";
import type { DatabaseContext } from "../database-context.js";
import type { ContextField } from "../core/schemas.js";
import type { UserContext } from "../shared/schemas.js";
import { FIELD_SNIPPETS } from "../orcestrator/snippets-extractor.js";

type SelectivityResult = {
  fieldName: ContextField;
  estimatedRows: number;
};

const FALLBACK_SELECTIVITY = 1_000_000;

export class SelectivityService {
  constructor(private db: DatabaseContext) {}

  /**
   * Return strict fields ordered by their estimated selectivity (lower first).
   * Falls back to the original order if EXPLAIN fails or no field values present.
   */
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

    if (!results.length) return strictFields;

    return results
      .sort((a, b) => a.estimatedRows - b.estimatedRows)
      .map((r) => r.fieldName);
  }

  private getContextFieldValue(context: UserContext, field: ContextField): unknown {
    if (field === "position") return context.position;
    if (field === "domains") return context.domains;
    if (field === "skills") return context.skills;
    if (field === "industry") return context.industry;
    if (field === "companySize") return context.companySize;
    if (field === "countryCode") return context.countryCode;
    if (field === "cityName") return context.cityName;
    return context.birthYear;
  }

  private getStartPattern(fieldName: ContextField): string | undefined {
    return FIELD_SNIPPETS[fieldName]?.startPattern;
  }

  private async getFieldSelectivity(
    tx: ManagedTransaction,
    fieldName: ContextField,
    fieldValue: unknown
  ): Promise<SelectivityResult> {
    const startPattern = this.getStartPattern(fieldName);
    if (!startPattern) {
      return { fieldName, estimatedRows: FALLBACK_SELECTIVITY };
    }

    const query = `EXPLAIN ${startPattern} RETURN count(c)`;

    try {
      const result = await tx.run(query, { fieldValue });
      const estimatedRows = this.isPlanWithEstimatedRows(result.summary?.plan)
        ? parseInt(result.summary.plan!.arguments!.EstimatedRows, 10)
        : FALLBACK_SELECTIVITY;

      return { fieldName, estimatedRows };
    } catch {
      return { fieldName, estimatedRows: FALLBACK_SELECTIVITY };
    }
  }

  private isPlanWithEstimatedRows(plan: unknown): plan is Plan & {
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
