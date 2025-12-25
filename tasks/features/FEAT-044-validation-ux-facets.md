# FEAT-044: Validation UX — Facets & Token Limit Handling

**Status**: TODO
**Priority**: P0
**Component**: Facade (SearchGraph, NlpFormatter)
**Created**: 2025-12-25
**Depends on**: -
**Blocks**: FEAT-045

---

## Проблема

При validation (byTarget search) с большим количеством кандидатов:
1. **Token limit exceeded** — 20 кандидатов с траекториями = 160K+ токенов
2. **UX бессмысленный** — показывать 20 траекторий текстом нечитаемо
3. **Ошибка без graceful handling** — пользователь видит "Tool execution failed"

---

## Решение

**Progressive disclosure:**
1. Если candidates > MAX_CANDIDATES_FOR_ANALYSIS (10) → показать facets + предложить фильтры
2. Если candidates <= MAX_CANDIDATES_FOR_ANALYSIS → полный анализ + Chart

---

## Схемы (согласованы)

### FacetValue

```typescript
export const facetValueSchema = z.object({
  value: z.string(),
  count: z.number().int().positive(),
});

export type FacetValue = z.infer<typeof facetValueSchema>;
```

### CandidateFacets

```typescript
export const candidateFacetsSchema = z.object({
  totalCount: z.number().int().nonnegative(),
  countries: z.array(facetValueSchema),
  positions: z.array(facetValueSchema),
  roles: z.array(facetValueSchema),
  industries: z.array(facetValueSchema),
});

export type CandidateFacets = z.infer<typeof candidateFacetsSchema>;
```

### Константа

```typescript
export const MAX_CANDIDATES_FOR_ANALYSIS = 10;
```

### Response asking_after_validate (два варианта)

```typescript
// needsFiltering: true — слишком много
{
  phase: "asking_after_validate",
  needsFiltering: true,
  facets: CandidateFacets,
  extractedGoal: TargetContext,
  adhocContext: UserContext | null,
}

// needsFiltering: false — нормальное количество
{
  phase: "asking_after_validate",
  needsFiltering: false,
  candidates: MatchedCandidateWithPath[],
  chartUrl: string | null,
  extractedGoal: TargetContext,
  adhocContext: UserContext | null,
  appliedFilters: TargetSearchParams,
}
```

---

## Acceptance Criteria

1. **computeFacets()** — функция подсчёта уникальных значений с count
   - [ ] countries, positions, roles, industries
   - [ ] Сортировка по count desc

2. **Threshold логика в response-builder**
   - [ ] `candidates.length > MAX_CANDIDATES_FOR_ANALYSIS` → facets mode
   - [ ] Иначе → full mode (candidates + chartUrl)

3. **NLP prompt для facets**
   - [ ] "Нашёл N кандидатов, слишком много для анализа"
   - [ ] Показать распределение по полям
   - [ ] Предложить сузить поиск

4. **Schema updates**
   - [ ] `facetValueSchema`, `candidateFacetsSchema` в schemas.ts
   - [ ] `needsFiltering` в asking_after_validate response

5. **Graceful error handling**
   - [ ] Catch token limit errors → friendly message

6. **Тесты проходят**
   - [ ] lint + tsc
   - [ ] Существующие SearchGraph тесты

---

## Файлы для изменения

| Файл | Изменения |
|------|-----------|
| `src/shared/schemas.ts` | facetValueSchema, candidateFacetsSchema |
| `src/facade/langGraph/search-graph/types.ts` | MAX_CANDIDATES_FOR_ANALYSIS |
| `src/facade/langGraph/search-graph/utils/facets.ts` | computeFacets() — новый файл |
| `src/facade/langGraph/search-graph/response-builders.ts` | threshold логика |
| `src/facade/services/nlp-formatter/prompts.ts` | инструкции для facets |

---

## Оценка

| Аспект | Оценка |
|--------|--------|
| LOC | ~60 |
| Сложность | Средняя |
| Риск | Низкий |

---

## Notes

Обнаружено при тестировании с нормализованными Kaggle данными (225 users). byTarget search на "senior backend" вернул 20+ кандидатов → token limit exceeded.
