import type { Driver, Session, Plan } from "neo4j-driver";
import { FIELD_SNIPPETS } from "./snippets-extractor.js";
import { UserContext, ContextField } from "../schemas-zod.js";

type SelectivityResult = {
  strictField: ContextField;
  estimatedRows: number;
};

export const FALLBACK_SELECTIVITY = 1000000;

export async function getSelectiveStrictFields(
  driver: Driver,
  strictFields: ContextField[],
  userContext: UserContext
): Promise<ContextField[]> {
  const selectivityResults: SelectivityResult[] = [];
  const session = driver.session();
  try {
    // Профилируем селективность каждого поля
    for (const field of strictFields) {
      const fieldValue = userContext[field];
      if (fieldValue != null) {
        const result = await getFieldSelectivity(session, field, fieldValue);
        selectivityResults.push(result);
      }
    }
  } finally {
    await session.close();
  }
  // Сортируем по селективности: меньше estimatedRows = выше селективность
  return selectivityResults
    .sort((a, b) => a.estimatedRows - b.estimatedRows)
    .map((result) => result.strictField);
}

async function getFieldSelectivity(
  session: Session,
  strictField: ContextField,
  fieldValue: unknown
): Promise<SelectivityResult> {
  const startPattern = FIELD_SNIPPETS[strictField].startPattern;
  const query = `EXPLAIN ${startPattern} RETURN count(c)`;

  try {
    const result = await session.executeRead((tx) =>
      tx.run(query, { fieldValue })
    );

    const estimatedRows = isPlanWithEstimatedRows(result.summary?.plan)
      ? parseInt(result.summary.plan.arguments.EstimatedRows, 10)
      : FALLBACK_SELECTIVITY;

    return { strictField, estimatedRows };
  } catch {
    return { strictField, estimatedRows: FALLBACK_SELECTIVITY };
  }
}

function isPlanWithEstimatedRows(plan: unknown): plan is Plan & {
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

// === Utilities for selectivity profiling ===
