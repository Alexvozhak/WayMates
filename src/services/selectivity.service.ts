import type { ManagedTransaction, Plan } from "neo4j-driver";
import type {
  ContextField,
  TargetContext,
  UserContext,
} from "../schemas-zod.js";
import type { DatabaseContext } from "../database-context.js";
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
    userContext: UserContext | TargetContext
  ): Promise<ContextField[]> {
    const results = await this.db.read(async (tx) => {
      const selectivityResults: SelectivityResult[] = [];

      for (const fieldName of strictFields) {
        const fieldValue = userContext[fieldName];
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

  private async getFieldSelectivity(
    tx: ManagedTransaction,
    fieldName: ContextField,
    fieldValue: unknown
  ): Promise<SelectivityResult> {
    const startPattern = FIELD_SNIPPETS[fieldName].startPattern;
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
