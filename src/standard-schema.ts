import { Value } from "@sinclair/typebox/value";
import type { TSchema, Static } from "@sinclair/typebox";
import type { ZodTypeAny } from "zod";

// Standard Schema интерфейс для совместимости с FastMCP
export interface StandardSchemaV1<T = unknown> {
  readonly "~standard": {
    readonly version: 1;
    readonly vendor: "TypeBox" | "Zod";
    validate(
      value: unknown
    ):
      | { value: T; issues: never[] }
      | { issues: Array<{ message: string; path: string }> };
  };
}

// Функция для добавления Standard Schema интерфейса к TypeBox схемам
export function StandardSchema<T extends TSchema>(
  schema: T
): T & StandardSchemaV1<Static<T>> {
  const standardInterface = {
    version: 1 as const,
    vendor: "TypeBox" as const,
    validate(value: unknown) {
      if (Value.Check(schema, value)) {
        return { value: value as Static<T>, issues: [] };
      } else {
        const errors = [...Value.Errors(schema, value)];
        const issues = errors.map((error) => ({
          message: error.message,
          path: error.path,
        }));
        return { issues };
      }
    },
  };

  // Добавляем non-enumerable свойство ~standard
  Object.defineProperty(schema, "~standard", {
    value: standardInterface,
    enumerable: false,
    writable: false,
    configurable: false,
  });

  return schema as T & StandardSchemaV1<Static<T>>;
}

// Функция для добавления Standard Schema интерфейса к Zod схемам
export function StandardZodSchema<T extends ZodTypeAny>(
  schema: T
): T & StandardSchemaV1<T["_output"]> {
  const standardInterface = {
    version: 1 as const,
    vendor: "Zod" as const,
    validate(value: unknown) {
      const result = schema.safeParse(value);
      if (result.success) {
        return { value: result.data, issues: [] };
      } else {
        const issues = result.error.errors.map((error) => ({
          message: error.message,
          path: error.path.join("."),
        }));
        return { issues };
      }
    },
  };

  // Добавляем non-enumerable свойство ~standard
  Object.defineProperty(schema, "~standard", {
    value: standardInterface,
    enumerable: false,
    writable: false,
    configurable: false,
  });

  return schema as T & StandardSchemaV1<T["_output"]>;
}
