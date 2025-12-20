# План: Унификация на `null` (optional → nullable) — ✅ COMPLETED

> **Статус:** Завершено 2025-12-20
> **Сессии:** 5 (~8 часов)
> **Результат:** 0 TS ошибок, 107/119 тестов (12 flaky LLM)

## Цель
Заменить все `.optional()` на `.nullable()` для единообразия с:
- Neo4j (возвращает `null`)
- OpenAI Structured Output (требует `nullable`)
- JSON (не имеет `undefined`)

## Scope

| Категория | Количество | Файлы |
|-----------|------------|-------|
| `.optional()` поля | 48 | `src/shared/schemas.ts` |
| `.partial()` вызовы | 7 | `src/shared/schemas.ts` |
| `!== undefined` проверки | ~15 | normalizer.ts, story-manager.ts, и др. |
| `makeNullable()` использования | 4 | extraction nodes |

## Архитектурное решение

### Семантика
- **null** = "значение отсутствует" (единый способ везде)
- **undefined** = не используется (кроме JS runtime)

### Исключения
- Нет исключений — полная унификация на `null`

## Фазы реализации

### Фаза 1: Core schemas (userContextSchemaBase, trailSchemaBase)
**~20 изменений в schemas.ts**

```typescript
// БЫЛО:
birthYear: z.number().min(1950).optional()
companySize: z.string().optional()

// СТАЛО:
birthYear: z.number().min(1950).nullable()
companySize: z.string().nullable()
```

**Файл:** `src/shared/schemas.ts` строки 186-243

### Фаза 2: Target/Goal schemas
**~10 изменений**

```typescript
// БЫЛО:
export const targetContextSchema = z.object({
  position: fieldFilterSchema.optional(),
  ...
});

// СТАЛО:
export const targetContextSchema = z.object({
  position: fieldFilterSchema.nullable(),
  ...
});
```

**Файл:** `src/shared/schemas.ts` строки 345-352

### Фаза 3: Упрощение LLM схем (удалить `.partial()` и `makeNullable()`)

После миграции на nullable все бизнес-поля уже `T | null` — LLM схемы становятся просто `.pick()`:

```typescript
// БЫЛО (3 шага):
const userContextSchemaBase = z.object({ birthYear: z.number().optional() });
const adhocContextBase = userContextSchemaBase.pick({...}).partial();
const extractableAdhocSchema = makeNullable(adhocContextBase);

// СТАЛО (1 шаг):
const userContextSchemaBase = z.object({ birthYear: z.number().nullable() });
const adhocContextBase = userContextSchemaBase.pick({...});
// Готов для OpenAI без wrapper!
```

**Изменения:**
- `adhocContextBase` (278): убрать `.partial()`
- `updateContextInputSchema` (631): оставить `.partial()` (partial update семантика)
- `pathFieldsSchema.partial()` (721): оставить (опциональные поля результата)
- Удалить 4 использования `makeNullable()` в extraction nodes

### Фаза 4: Обновить проверки undefined → null

| Файл | Строка | Изменение |
|------|--------|-----------|
| `normalizer.ts` | 257 | `v !== undefined` → `v != null` |
| `story-manager.ts` | 134 | `value !== undefined` → `value != null` |
| `search-by-target.tool.ts` | 19 | `v !== undefined` → `v != null` |
| `set-goal.tool.ts` | 19 | `v !== undefined` → `v != null` |
| `search-manager.ts` | 113 | `!== undefined` → `!= null` |

### Фаза 5: Удалить `makeNullable()` полностью

После миграции `makeNullable()` не нужен — схемы уже nullable.

**Удалить:**
- `src/facade/utils/llm-schemas.ts` — весь файл
- Импорты `makeNullable` в 4 файлах extraction nodes

### Фаза 6: Очистка избыточных `.nullable().optional()`

11 полей имеют оба модификатора — удалить `.optional()`:

```typescript
// БЫЛО:
salaryExact: z.number().min(0).nullable().optional()

// СТАЛО:
salaryExact: z.number().min(0).nullable()
```

## Критические файлы

| Файл | Изменения | Риск |
|------|-----------|------|
| `src/shared/schemas.ts` | ~50 | High — все типы |
| `src/facade/services/normalizer.ts` | 3 | Medium |
| `src/facade/utils/llm-schemas.ts` | 1 | Low |
| `src/core/story-manager.ts` | 1 | Low |
| `src/core/search-manager.ts` | 1 | Low |

## Тестирование

1. **Unit тесты:** `npm run test:unit`
2. **Core integration:** `npm run test:integration` (Neo4j queries)
3. **Facade integration:** `npm run test:facade:run` (LLM extraction)
4. **Telegram integration:** `npx vitest --project telegram-integration`

## Риски и митигация

| Риск | Митигация |
|------|-----------|
| Breaking changes в типах | TypeScript покажет все ошибки |
| Destructuring defaults `{ foo = default }` | Заменить на `foo ?? default` |
| Falsy checks `if (!x)` | Работают одинаково для null/undefined |

## Оценка

- **LOC изменений:** ~150
- **Файлов:** ~10
- **Время:** 1-2 часа
- **Риск регрессий:** Medium (но TS + тесты ловят)

## ESLint правило (предотвращение регрессий)

После миграции добавить в `eslint.config.mjs`:

```javascript
'no-restricted-syntax': [
  'error',
  {
    selector: "CallExpression[callee.property.name='optional']",
    message: "Use .nullable() instead of .optional() — null is our standard for missing values"
  }
]
```

**Примечание:** Автофикса нет — это только предотвращение новых `.optional()`.

## Порядок выполнения

1. **Миграция schemas.ts** — Edit tool с `replace_all=true`:
   ```
   Edit(file="src/shared/schemas.ts", old=".optional()", new=".nullable()", replace_all=true)
   ```
   Один вызов заменит все 48 вхождений.

2. **nullablePartial утилита** — заменить `.partial()`
3. **undefined → null проверки** — ~15 мест (Edit tool)
4. `npx tsc --noEmit` — исправить ошибки типов
5. **ESLint правило** — добавить no-restricted-syntax
6. `npm run lint:fix` — автоформат
7. **Тесты** — прогнать все
8. **E2E-SG-01** — должен пройти
