# FEAT-044: Validation UX — Facets & Limits Consolidation

**Status**: TESTING
**Priority**: P0
**Component**: Facade (SearchGraph, NlpFormatter, env config)
**Created**: 2025-12-25
**Depends on**: -
**Blocks**: FEAT-045

---

## Проблема

1. **Token limit exceeded** — 20 кандидатов с траекториями = 160K+ токенов
2. **UX бессмысленный** — показывать 20 траекторий текстом нечитаемо
3. **Лимиты размазаны** — DEFAULT_LIMIT в types.ts, FACETS в env.ts, user может менять через filter intent

---

## Решение

### 1. Progressive Disclosure
- `candidates > FACETS_MAX_CANDIDATES` → показать facets + предложить фильтры
- `candidates ≤ FACETS_MAX_CANDIDATES` → полный анализ + Chart

### 2. Консолидация лимитов в env.ts
- `SEARCH_LIMIT = 20` — лимит для Cypher + pathLimit (фиксировано)
- `FACETS_MAX_CANDIDATES = 10` — порог для progressive disclosure
- Пользователь НЕ может менять лимиты (игнорируем input)

### 3. FacetField через extract
- Использовать `contextFieldSchema.extract()` вместо hardcoded типа
- 4 поля для facets: countryCode, position, role, industry

---

## Архитектура лимитов

```
Facade env.ts
  ├─ SEARCH_LIMIT = 20         → limit & pathLimit для Core
  └─ FACETS_MAX_CANDIDATES = 10 → порог показа facets

Facade nodes (explore/search/validate)
  └─ params.limit = config.SEARCH_LIMIT  ← всегда из config

Facade apply-filters
  └─ игнорирует user input для limit/pathLimit

Core API
  └─ получает limit/pathLimit → Cypher LIMIT $limit
```

---

## Что сделано

- [x] `facetValueSchema`, `candidateFacetsSchema` в schemas.ts
- [x] `askingAfterValidateResponseSchema` с discriminatedUnion по needsFiltering (инлайнен)
- [x] `FACETS_MAX_CANDIDATES`, `FACETS_MAX_JSON_SIZE_KB` в env.ts
- [x] `facets.ts` создан (computeFacets, shouldUseFacets)
- [x] `FacetField` через extract в schemas.ts
- [x] `CANDIDATES_FETCH_LIMIT` / `CANDIDATES_DISPLAY_LIMIT` в env.ts (50/20)
- [x] Убран `DEFAULT_LIMIT` из types.ts — используем config
- [x] `response-builders.ts` — threshold логика для asking_after_validate
- [x] `show-results.ts` — chart с `mode: "full"` + `maxCandidates` из config
- [x] NLP prompt обновлён для facets режима
- [x] Тесты обновлены (needsFiltering guards)
- [x] lint + tsc чисто

---

## Что нужно протестировать

### 1. Порог facets (threshold)
```bash
npm run test:facade:setup

# Маленький результат (< 10 candidates) — ожидание: needsFiltering=false
npx tsx poc/mcp-chat.ts --reset
npx tsx poc/mcp-chat.ts "я backend разработчик"
npx tsx poc/mcp-chat.ts "хочу стать senior в Германии"
npx tsx poc/mcp-chat.ts "проверь"
```

### 2. Facets режим (много результатов)
```bash
# Широкий запрос (> 10 candidates) — ожидание: needsFiltering=true, facets
npx tsx poc/mcp-chat.ts --reset
npx tsx poc/mcp-chat.ts "я разработчик"
npx tsx poc/mcp-chat.ts "хочу стать senior"
npx tsx poc/mcp-chat.ts "проверь"
```

### 3. NLP ответы
- `needsFiltering=true`: показать totalCount + distribution, предложить сузить
- `needsFiltering=false`: показать candidates как обычно

### 4. Integration тесты
```bash
npm run test:facade:run -- --filter validate-clarify
```

### 5. Chart с лимитами
- `show_results` генерирует chart с `maxCandidates: 20` из config

---

## Изменённые файлы

| Файл | Изменения |
|------|-----------|
| `src/shared/schemas.ts` | FacetField через extract, инлайн варианты asking_after_validate |
| `src/facade/env.ts` | CANDIDATES_FETCH_LIMIT, CANDIDATES_DISPLAY_LIMIT |
| `src/facade/langGraph/search-graph/types.ts` | убран DEFAULT_LIMIT, используем config |
| `src/facade/langGraph/search-graph/facets.ts` | импорт FacetField из schemas |
| `src/facade/langGraph/search-graph/response-builders.ts` | threshold логика |
| `src/facade/langGraph/search-graph/nodes/show-results.ts` | mode + maxCandidates |
| `src/facade/services/nlp-formatter/prompts.ts` | facets режим |
| `tests/facade/agents/search-graph/helpers/search-graph-helpers.ts` | config вместо DEFAULT_LIMIT |
| `tests/facade/agents/search-graph/integration/validate-clarify.integration.ts` | needsFiltering guards |
