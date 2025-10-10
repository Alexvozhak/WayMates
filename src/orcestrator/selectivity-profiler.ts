import type { Driver } from "neo4j-driver";
import { FIELD_SNIPPETS } from "./snippets-extractor.js";
import { ContextField, UserContext } from "../schemas-zod.js";

type SelectivityResult = {
  field: ContextField;
  estimatedRows: number;
};

export const FALLBACK_SELECTIVITY = 1000;

export async function getOptimalFieldOrder(
  driver: Driver,
  strictPresets: ContextField[],
  userContext: UserContext
): Promise<ContextField[]> {
  const notOptimalFields: ContextField[] = [];
  for (const field of strictPresets) {
    if (userContext[field] != null) {
      notOptimalFields.push(field);
    }
  }

  if (notOptimalFields.length <= 1) {
    return notOptimalFields;
  }

  const profilePromises = [];
  for (const field of notOptimalFields) {
    const value = userContext[field];
    profilePromises.push(runProfile(driver, field, value));
  }

  const profileResults = await Promise.allSettled(profilePromises);
  const selectivities = processResults(profileResults, notOptimalFields);

  selectivities.sort((a, b) => a.estimatedRows - b.estimatedRows);

  const optimalFields: ContextField[] = [];
  for (const selectivity of selectivities) {
    optimalFields.push(selectivity.field);
  }

  return optimalFields;
}

async function runProfile(
  driver: Driver,
  field: ContextField,
  value: unknown
): Promise<number> {
  const session = driver.session();
  try {
    const query = buildExplainQuery(field);
    const result = await session.executeRead((tx) => tx.run(query, { value }));
    return (
      (result.summary?.plan as any)?.arguments?.EstimatedRows ||
      FALLBACK_SELECTIVITY
    );
  } finally {
    await session.close();
  }
}

export function buildExplainQuery(field: ContextField): string {
  if (!(field in FIELD_SNIPPETS)) {
    throw new Error(
      `Unknown field '${field}'. Available: ${Object.keys(FIELD_SNIPPETS).join(", ")}`
    );
  }
  const startPattern = FIELD_SNIPPETS[field].startPattern;
  return `EXPLAIN ${startPattern} RETURN count(c)`;
}

export function processResults(
  results: PromiseSettledResult<number>[],
  fields: ContextField[]
): SelectivityResult[] {
  return results.map((result, index) => {
    const field = fields[index]!;
    if (result.status === "fulfilled") {
      return { field, estimatedRows: result.value };
    }
    return { field, estimatedRows: FALLBACK_SELECTIVITY };
  });
}
