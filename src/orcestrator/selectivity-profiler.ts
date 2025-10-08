import type { Driver } from "neo4j-driver";
import { FIELD_SNIPPETS } from "./snippets-extractor.js";
import { ContextField, StrictPreset, UserContext } from "../schemas-zod.js";

type SelectivityResult = {
  field: ContextField;
  estimatedRows: number;
};

export const FALLBACK_SELECTIVITY = 1000;

export async function getOptimalFieldOrder(
  driver: Driver,
  strictPresets: StrictPreset[],
  userContext: UserContext
): Promise<ContextField[]> {
  const strictedFields = strictPresets.map(
    (strictPreset) => strictPreset.field
  );

  const userStrictedFields = strictedFields.filter(
    (strictedField) =>
      userContext[strictedField] !== undefined &&
      userContext[strictedField] !== null
  );

  if (userStrictedFields.length <= 1) return userStrictedFields;

  const profileResults = await Promise.allSettled(
    userStrictedFields.map((strictedField) => {
      const strictedValue = userContext[strictedField];
      return runProfile(driver, strictedField, strictedValue);
    })
  );

  const selectivities = processResults(profileResults, userStrictedFields);

  return selectivities
    .sort((a, b) => a.estimatedRows - b.estimatedRows)
    .map((s) => s.field);
}

async function runProfile(
  driver: Driver,
  field: ContextField,
  value: unknown
): Promise<number> {
  const session = driver.session();
  try {
    const query = buildExplainQuery(field, value);
    const result = await session.executeRead((tx) => tx.run(query, { value }));
    return (
      (result.summary?.plan as any)?.arguments?.EstimatedRows ||
      FALLBACK_SELECTIVITY
    );
  } finally {
    await session.close();
  }
}

export function buildExplainQuery(field: ContextField, value?: any): string {
  if (!(field in FIELD_SNIPPETS)) {
    throw new Error(
      `Unknown field '${field}'. Available: ${Object.keys(FIELD_SNIPPETS).join(", ")}`
    );
  }
  const startPattern = FIELD_SNIPPETS[field].startPattern;
  if (typeof startPattern === "function") {
    return `EXPLAIN ${(startPattern as any)(value)} RETURN count(c)`;
  }
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
