# Add languages B2+ support to Context

**Component**: Multiple (Schema + Search + Persistence)

**Priority**: 🟡 P1 (Important)

---

## User Story

Как пользователь, ищущий карьерные пути, я хочу фильтровать по уровню владения языками, чтобы находить возможности, соответствующие моим языковым навыкам.

---

## AS IS

В схеме Context отсутствует поле languages. Пользователи не могут фильтровать по языкам и не видят языковые требования в карьерных путях.

---

## TO BE

Context с массивом languages (ISO коды). Search поддерживает strict/excluded/target фильтрацию. Persistence сохраняет в Neo4j. Map projection возвращает languages. 7 интеграционных тестов (6 P0+P1).

---

## Context to Study

**Перед реализацией изучить:**

1. `src/shared/schemas.ts` - Context schema, contextFieldSchema enum
2. `database/import-positions.ts` - паттерн импорта справочников
3. `database/positions.json` - формат справочника (key-value)
4. `src/cypher/queries/persistence.ts` - MERGE relationships pattern
5. `src/cypher/queries/search-query-builder.ts` - фильтры (adhoc/current search)
6. `src/cypher/queries/target-query-builder.ts` - фильтры (target search, desired/undesired)
7. `tests/integration/search-manager/adhoc-context-without-dtw.integration.ts` - существующие тесты
8. `tests/integration/search-manager/target-search.integration.ts` - target search тесты
9. `data/trails/users/u1.json` - формат тестовых данных

---

## Type Schema

### **Zod schemas (src/shared/schemas.ts)**

```typescript
// === LANGUAGE SCHEMAS ===

/**
 * ISO 639-1 language code (2-letter lowercase)
 * Valid codes defined in database/languages.json
 */
export const languageCodeSchema = z
  .string()
  .length(2)
  .regex(/^[a-z]{2}$/, "Language code must be lowercase ISO 639-1 format")
  .describe("ISO 639-1 language code (e.g., 'en', 'de', 'ru')");

export type LanguageCode = z.infer<typeof languageCodeSchema>;

// === UPDATE CONTEXT SCHEMA ===

const userContextSchemaBase = z.object({
  // ... existing fields ...

  // ADD: Languages (B2+ proficiency)
  // Semantics: If language in array → B2+ level (fluent for work)
  languages: z
    .array(languageCodeSchema)
    .nullable()
    .optional()
    .describe("Languages with B2+ proficiency (if present → work-ready level)"),
});
```

### **ContextField enum (src/core/schemas.ts)**

```typescript
export const contextFieldSchema = z.enum([
  "position",
  "domains",
  "skills",
  "industry",
  "countryCode",
  "cityName",
  "companySize",
  "birthYear",
  "educationLevel",
  "languages", // ADD
]);
```

### **Neo4j schema**

```cypher
// Constraint
CREATE CONSTRAINT language_code_unique IF NOT EXISTS
FOR (l:Language) REQUIRE l.code IS UNIQUE;

// Index
CREATE INDEX language_code IF NOT EXISTS
FOR (l:Language) ON (l.code);

// Relationship (только если is_fluent: true)
(Context)-[:SPEAKS_FLUENT]->(Language {code: "en", name: "English"})
```

---

## Architecture Decisions

### **1. Binary matching (B2+ only)**

**Decision**: Массив языков без уровня. Если язык в списке → B2+.

**Rationale**: Простота, нет оверинжиниринга. Для MVP достаточно "fluent or not".

**Alternative rejected**: CEFR levels (A1-C2) - сложнее, избыточно для MVP.

---

### **2. Dictionary import pattern**

**Decision**: По аналогии с `import-positions.ts`:
- `database/languages.json` - справочник (code → name)
- `database/import-languages.ts` - скрипт импорта
- MERGE в Neo4j при старте

**Rationale**: Переиспользование существующего паттерна, consistency.

---

### **3. Search filtering modes**

| Режим | Логика | Cypher |
|-------|--------|--------|
| **Adhoc/Current strict** | `excludedContextFields: []` → must have ALL | `all(lang IN $searchLanguages WHERE exists(...))` |
| **Adhoc/Current excluded** | `excludedContextFields: ["languages"]` → ignore | No filter |
| **Adhoc/Current null** | `languages: null` → wildcard | `$searchLanguages IS NULL OR all(...)` |
| **Target desired** | `mode: "desired"` → match ANY (OR) | `any(lang IN $targetLanguages WHERE exists(...))` |
| **Target undesired** | `mode: "undesired"` → exclude ALL | `none(lang IN $targetLanguages WHERE exists(...))` |

---

### **4. Affected components**

| Компонент | Изменение | Файл |
|-----------|-----------|------|
| Schema | Add `languages` field | `src/shared/schemas.ts` |
| Context enum | Add "languages" | `src/core/schemas.ts` |
| Dictionary | New Language справочник | `database/languages.json`, `database/import-languages.ts` |
| Persistence | MERGE relationships | `src/cypher/queries/persistence.ts` |
| Search (Adhoc/Current) | Strict/excluded/null filtering | `src/cypher/queries/search-query-builder.ts` |
| Search (Target) | Desired/undesired filtering | `src/cypher/queries/target-query-builder.ts` |
| Map projection | Return languages | `src/cypher/queries/search-query-builder.ts` |
| Test data | Add languages to U1-U4 | `data/trails/users/u1-u4.json` |
| Tests | 7 integration tests | `tests/integration/` |

---

## Implementation Plan

### **Step 1: Schema changes** (~10 строк)
1. Add `languageCodeSchema` to `src/shared/schemas.ts`
2. Add `languages` field to `userContextSchemaBase`
3. Update `contextFieldSchema` enum in `src/core/schemas.ts`

### **Step 2: Dictionary setup** (~80 строк)
1. Create `database/languages.json` (17 languages: en, de, ru, fr, es, zh, ja, pt, it, pl, uk, ar, hi, tr, nl, sv, ko)
2. Create `database/import-languages.ts` (по аналогии с import-positions.ts)
3. Add constraint + index to `database/init.cypher`

### **Step 3: Persistence** (~15 строк)
1. Update `src/cypher/queries/persistence.ts`:
   - UNWIND languages → MERGE Language nodes
   - MERGE `:SPEAKS_FLUENT` relationships

### **Step 4: Search filtering** (~70 строк)
1. Update `src/cypher/queries/search-query-builder.ts`:
   - Adhoc/current strict filtering (all() logic)
   - Adhoc/current excluded filtering (skip filter)
   - Adhoc/current null wildcard (IS NULL OR all())
   - Map projection (return languages array)

2. Update `src/cypher/queries/target-query-builder.ts`:
   - Target desired filtering (any() logic)
   - Target undesired filtering (none() logic)

### **Step 5: Test data** (~4 файла, 5 строк)
1. Extend `data/trails/users/u1.json` - add `languages: ["en"]`
2. Extend `data/trails/users/u2.json` - add `languages: ["de"]`
3. Leave `data/trails/users/u3.json` - `languages: null` (уже есть)
4. Extend `data/trails/users/u4.json` - add `languages: ["en", "de"]`

### **Step 6: Integration tests** (~165 строк)
1. `tests/integration/persistence/import-story.integration.ts`:
   - SC6: Persistence (languages saved to Neo4j)

2. `tests/integration/search-manager/adhoc-context-without-dtw.integration.ts`:
   - SC1+SC3: Strict matching (single + multiple AND)
   - SC2: Languages excluded (inverse logic)
   - SC4: Null wildcard
   - SC7: Map projection (languages returned)

3. `tests/integration/search-manager/target-search.integration.ts`:
   - TG-LANG-1: Desired mode (match ANY)
   - TG-LANG-2: Undesired mode (exclude ALL)

### **Step 7: Quality gates**
1. Run `npm run lint` → fix errors
2. Run `npx tsc --noEmit` → fix type errors
3. Run `npm run test:integration` → verify tests pass
4. Call `reviewer` agent → fix bugs/DRY violations
5. Call `qa` agent → verify test quality

---

## Test Plan

### **Минимальный набор (6 тестов P0+P1)**

| # | Тест | Режим | Приоритет | Регрессия |
|---|------|-------|-----------|-----------|
| SC1+SC3 | Strict matching (single + AND) | Adhoc/Current | 🔴 P0 | Забыли фильтр → показали всех |
| SC2 | Languages excluded (inverse) | Adhoc/Current | 🔴 P0 | Inverse перепутана → показали только с en |
| SC4 | Null wildcard | Adhoc/Current | 🔴 P0 | Null → "нет языков" → пустой результат |
| SC6 | Persistence | All | 🔴 P0 | Забыли persistence → данные потеряны |
| SC7 | Map projection | All | 🔴 P0 | Забыли map projection → UI пустое поле |
| TG-LANG-1 | Target desired (ANY) | Target | 🟡 P1 | OR → AND → показали только с обоими |
| TG-LANG-2 | Target undesired (exclude) | Target | 🟡 P1 | Логика инвертирована → показали с en |

### **Test data distribution**

| User | Languages | SC1 | SC3 | SC2 | SC4 | TG-1 | TG-2 |
|------|-----------|-----|-----|-----|-----|------|------|
| U1 | `["en"]` | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ |
| U2 | `["de"]` | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| U3 | `null` | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ |
| U4 | `["en","de"]` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |

---

## Insights

### **Semantics (critical for documentation)**

**Правило**: Если язык присутствует в массиве `languages` → уровень B2 и выше (work-ready fluent).

- `languages: ["en"]` → English B2+
- `languages: ["en", "de"]` → English B2+ AND German B2+
- `languages: []` → нет языков B2+
- `languages: null` или отсутствует → данные не заполнены (legacy)

### **AND vs OR logic**

| Режим | Логика |
|-------|--------|
| Adhoc/Current strict | AND (все языки требуются) |
| Target desired | OR (хотя бы один язык) |

**Rationale**:
- Adhoc/Current ищут "кто подходит мне" → строгое совпадение (AND)
- Target ищут "кто достиг моей цели" → мягкое совпадение (OR)

### **Null handling**

- **Search.languages = null** → Не фильтруем (wildcard)
- **Candidate.languages = null** → Не подходит под strict (нет данных)

---

## Guidelines

### **DO**

✅ **Use binary semantics** (in array = B2+)
✅ **Follow import-positions.ts pattern** для справочника
✅ **Add languages to contextFieldSchema** enum
✅ **Use MERGE for Language nodes** (prevent duplicates)
✅ **Add map projection** для возврата languages
✅ **Test ALL 3 modes** (strict, excluded, null wildcard)
✅ **Test Target modes** (desired, undesired)
✅ **Validate ISO codes** через regex /^[a-z]{2}$/
✅ **Update CONTEXT_FIELD_NAMES** constant
✅ **Run quality gates** (lint + tsc + tests + reviewer + qa)

### **DON'T**

❌ **Don't use CEFR levels** (A1-C2) - избыточно для MVP
❌ **Don't use `is_fluent` boolean** - упрощено до массива
❌ **Don't forget null wildcard** - backward compatibility critical
❌ **Don't mix AND/OR logic** - adhoc=AND, target=OR
❌ **Don't skip map projection** - UI не увидит языки
❌ **Don't forget SC3 test** (multiple AND) - критичная логика
❌ **Don't create duplicate Language nodes** - use MERGE
❌ **Don't skip persistence test** - данные могут потеряться
❌ **Don't use enum for languageCodeSchema** - regex лучше (расширяемость)
❌ **Don't skip reviewer/qa** - обязательные проверки

---

## DoD (Definition of Done)

- [x] Schema updated (languageCodeSchema + languages field + contextFieldSchema enum)
- [x] Dictionary created (languages.json + import-languages.ts)
- [x] Constraint + index added (init.cypher)
- [x] Persistence updated (MERGE Language + SPEAKS_FLUENT)
- [x] Search queries updated (adhoc/current + target, strict/excluded/null/desired/undesired)
- [x] Map projection updated (return languages array)
- [x] Test data updated (U1-U4 extended)
- [x] 7 integration tests written (SC1+SC3, SC2, SC4, SC6, SC7, TG-1, TG-2)
- [x] Tests pass (npm run test:integration)
- [x] Lint passes (npm run lint)
- [x] TypeScript compiles (npx tsc --noEmit)
- [x] reviewer validated (no bugs, DRY violations, edge cases)
- [x] qa validated (test quality 90%+, no coverage theater)

---

## Impact Assessment

### **Schema changes**
- ✅ **Schema change**: YES (adds `languages` field to Context)
- ❌ **Breaking change**: NO (nullable/optional field, backward compatible)
- ❌ **Migration required**: NO (new field, existing data unaffected)

### **Affected components**
- Schema: `src/shared/schemas.ts`, `src/core/schemas.ts`
- Database: `database/languages.json`, `database/import-languages.ts`, `database/init.cypher`
- Query builders: `src/cypher/queries/persistence.ts`, `src/cypher/queries/search-query-builder.ts`, `src/cypher/queries/target-query-builder.ts`
- Test data: `data/trails/users/u1-u4.json`
- Tests: `tests/integration/persistence/import-story.integration.ts`, `tests/integration/search-manager/adhoc-context-without-dtw.integration.ts`, `tests/integration/search-manager/target-search.integration.ts`

### **New dependencies**
- ❌ None (uses existing Neo4j, Zod, Vitest)

---

## Edge Cases & Risks

### **Edge Cases**

| Case | Expected behavior |
|------|-------------------|
| Empty array `languages: []` | Valid (нет языков B2+) |
| Null `languages: null` | Legacy data (skip filter in search) |
| Invalid ISO code `["english"]` | Zod validation error (regex /^[a-z]{2}$/) |
| Uppercase code `["EN"]` | Zod validation error (must be lowercase) |
| Duplicate languages `["en", "en"]` | Valid (Neo4j MERGE prevents duplicate relationships) |
| Unknown ISO code `["zz"]` | Valid (но нет в справочнике languages.json) |
| Mixed case search `languages: null` + `excludedContextFields: []` | Wildcard (null → не фильтруем) |
| Multiple AND `["en", "de", "fr"]` | all() logic (кандидат должен иметь ВСЕ 3 языка) |

### **Risks**

| Риск | Вероятность | Mitigation |
|------|-------------|------------|
| Забыли map projection → UI пустое поле | 🟡 Medium | SC7 test (verify languages returned) |
| Inverse logic перепутана → показали неправильных кандидатов | 🟡 Medium | SC2 test (excluded mode) |
| Null wildcard не работает → backward compatibility broken | 🔴 High | SC4 test (null search) |
| AND вместо OR в target search → слишком жесткий фильтр | 🟡 Medium | TG-LANG-1 test (ANY logic) |
| Persistence не сохраняет → данные потеряны | 🔴 High | SC6 test (verify Neo4j) |
| MERGE не работает → duplicate Language nodes | 🟢 Low | Constraint + MERGE pattern |

---

## Объем изменений

| Категория | Файлов | Строк |
|-----------|--------|-------|
| Schema | 2 | ~15 |
| Database | 3 | ~85 |
| Query builders | 3 | ~90 |
| Test data | 3 | ~3 |
| Tests | 3 | ~165 |
| **ИТОГО** | **14** | **~360** |
