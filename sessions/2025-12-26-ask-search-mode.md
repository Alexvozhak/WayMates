# Session Log: ask_search_mode + Prompt Refactoring

**Дата:** 2025-12-26
**Ветка:** `feature/search-refactor`
**Статус:** DONE (ask_search_mode) + PARTIAL (prompt refactoring)

---

## Контекст

FEAT-046 завершён (коммит `fe886d7`). Реализовали P1: ask_search_mode + исправили баг с intent classification.

---

## Фаза 1: ask_search_mode Implementation (DONE)

### Что сделано
- Новый interrupt `ask_search_mode` после `set_goal`
- Два новых node: `search_waymates`, `search_pathfinders` (заменили `search`)
- Routing, schemas, response builders обновлены

### Flow
```
set_goal → ask_search_mode (INTERRUPT) → parse_intent → search_waymates | search_pathfinders → show_results
```

---

## Фаза 2: Bug Fix — Intent Classification (DONE)

### Баг
"проводники" классифицировался как `validate` → routing fallback → `cancel`

### Причины
1. `searchPathfinders` / `searchWaymates` НЕ были в Zod schema (`parse-intent.ts`)
2. Prompt использовал UPPERCASE (`SEARCH_PATHFINDERS`), schema — camelCase
3. PHASE_CONTEXT использовал hardcoded строки, не связанные с enum

### Решение — Single Source of Truth

| Файл | Изменение |
|------|-----------|
| `state.ts` | `SIMPLE_INTENTS`, `COMPLEX_INTENTS` — const arrays |
| `state.ts` | `SearchUserIntent = SimpleIntent \| ComplexIntent` — derived type |
| `parse-intent.ts` | `z.enum(SIMPLE_INTENTS)` — берёт из state |
| `prompts.ts` | `INTENT_DESCRIPTIONS: Record<SearchUserIntent, string>` — TypeScript проверяет полноту |
| `prompts.ts` | `intents()` helper — type-safe список для PHASE_CONTEXT |
| `prompts.ts` | `buildUserIntentPrompt` — throw `AgentInvariantError` вместо defensive fallback |

### Пример нового PHASE_CONTEXT
```typescript
const intents = (...names: SearchUserIntent[]): string => names.join(", ");

[PHASE.asking_search_mode]: `Bot saved goal and asks which search mode.
Valid: ${intents("searchPathfinders", "searchWaymates", "cancel")}`,
```

---

## Фаза 3: Prompt Refactoring (TODO — следующая сессия)

### Что нужно сделать
Применить тот же подход к остальным промптам:
- `GOAL_EXTRACTION_PROMPT`
- `GOAL_CLARIFICATION_PROMPT`
- `ADHOC_EXTRACTION_PROMPT`
- `nlp-formatter/prompts.ts`

### Принципы
1. **Single Source of Truth** — enum/const arrays в одном месте
2. **Type-safe** — TypeScript проверяет полноту
3. **Без прелюдий** — только валидные значения, описания в отдельном map
4. **Фиксированная терминология** — один термин = одно значение
5. **Без defensive programming** — throw если инвариант нарушен

---

## Рефлексия

### Первопричина бага
**Рассинхрон между слоями:**
- Routing знает об интентах (`search-router.ts`)
- Zod schema не знает (`parse-intent.ts`)
- Prompt использует другой case (`prompts.ts`)

**Урок:** При добавлении нового intent — проверять ВСЕ слои:
1. `state.ts` — type definition
2. `parse-intent.ts` — Zod schema
3. `prompts.ts` — INTENT_DESCRIPTIONS + PHASE_CONTEXT
4. `search-router.ts` — routing

### Добавить в guidelines.md
Новый паттерн ошибки: "Intent добавлен в routing, но не в schema"

---

## Ключевые файлы

- `src/facade/langGraph/search-graph/state.ts` — SIMPLE_INTENTS, COMPLEX_INTENTS
- `src/facade/langGraph/search-graph/prompts.ts` — INTENT_DESCRIPTIONS, PHASE_CONTEXT
- `src/facade/langGraph/search-graph/nodes/parse-intent.ts` — Zod schema

---

## Промпт для rewind

```
Изучи sessions/2025-12-26-ask-search-mode.md

КОНТЕКСТ:
- Ветка: feature/search-refactor
- ask_search_mode DONE, intent classification bug FIXED
- Следующий шаг: refactor остальных промптов по тому же паттерну

ЧТО СДЕЛАНО:
- SIMPLE_INTENTS/COMPLEX_INTENTS в state.ts — single source of truth
- INTENT_DESCRIPTIONS: Record<SearchUserIntent, string> — type-safe
- intents() helper для PHASE_CONTEXT
- AgentInvariantError вместо defensive fallback

ЧТО ДЕЛАТЬ:
1. Применить тот же подход к GOAL_EXTRACTION_PROMPT, ADHOC_EXTRACTION_PROMPT
2. Убрать hardcoded строки, сделать type-safe
3. facade:rebuild + mcp-chat тест

ПРИНЦИПЫ:
- Single source of truth (enum в state.ts)
- Type-safe (Record<EnumType, string>)
- Без прелюдий (только valid values)
- Throw при нарушении инварианта
```
