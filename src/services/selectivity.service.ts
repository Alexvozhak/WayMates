import type { Driver, Session, Plan } from "neo4j-driver";
import type {
  ContextField,
  TargetContext,
  UserContext,
} from "../schemas-zod.js";
import { FIELD_SNIPPETS } from "../orcestrator/snippets-extractor.js";

type SelectivityResult = {
  fieldName: ContextField;
  estimatedRows: number;
};

const FALLBACK_SELECTIVITY = 1_000_000;

export class SelectivityService {
  constructor(private driver: Driver) {}

  /**
   * Return strict fields ordered by their estimated selectivity (lower first).
   * Falls back to the original order if EXPLAIN fails or no field values present.
   */
  async rankStrictFields(
    strictFields: ContextField[],
    userContext: UserContext | TargetContext
  ): Promise<ContextField[]> {
    const session = this.driver.session();
    const results: SelectivityResult[] = [];

    try {
      for (const fieldName of strictFields) {
        const fieldValue = userContext[fieldName];
        if (fieldValue != null) {
          const result = await this.getFieldSelectivity(
            session,
            fieldName,
            fieldValue
          );
          results.push(result);
        }
      }
    } catch {
      // swallow, we fallback later
    } finally {
      await session.close();
    }

    if (!results.length) return strictFields; // fallback

    return results
      .sort((a, b) => a.estimatedRows - b.estimatedRows)
      .map((r) => r.fieldName);
  }

  private async getFieldSelectivity(
    session: Session,
    fieldName: ContextField,
    fieldValue: unknown
  ): Promise<SelectivityResult> {
    const startPattern = FIELD_SNIPPETS[fieldName].startPattern;
    const query = `EXPLAIN ${startPattern} RETURN count(c)`;

    try {
      const result = await session.executeRead((tx) =>
        tx.run(query, { fieldValue })
      );
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
