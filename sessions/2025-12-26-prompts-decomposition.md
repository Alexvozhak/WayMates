# Session Log: Prompts Decomposition + Consistency

**Дата:** 2025-12-26
**Ветка:** `feature/search-refactor`
**Статус:** IN PROGRESS

---

## Контекст

Продолжение FEAT-046. Аудит и рефакторинг промптов для консистентности паттернов.

---

## Фаза 1: Аудит консистентности промптов (DONE)

### Что сделано

Проведён аудит всех промптов на консистентность:

| Файл | Проблема | Решение |
|------|----------|---------|
| `intent-classifier.ts` | `Map` вместо `Record` | → `Record<UserIntent, string>` |
| `nlp-formatter/prompts.ts` | Inline phase descriptions | → `SEARCH_PHASE_DESCRIPTIONS: Record<SearchPhase, string>` |

### Ключевой инсайт

**Два файла промптов — разные ЗО:**
- `search-graph/prompts/` — Extraction + Classification (text → data)
- `nlp-formatter/prompts.ts` — NLP Formatting (data → text)

Это НЕ дублирование — противоположные операции.

---

## Фаза 2: Декомпозиция prompts.ts (DONE)

### Что сделано

Разделили monolith `prompts.ts` (270 LOC) на 3 файла по ЗО:

```
search-graph/prompts/
├── extraction.ts      # Adhoc + Goal extraction/clarification
├── classification.ts  # Intent parsing + phase context
├── advisor.ts         # Advisor system + intent prompts
└── index.ts           # Re-exports
```

### Ключевые решения

1. **Builder functions с явными аргументами** (не `.replace()` placeholders):
   ```typescript
   // Было
   GOAL_CLARIFICATION_PROMPT.replace("{currentGoal}", json)

   // Стало
   buildGoalClarificationPrompt(currentGoal, userMessage)
   ```

2. **Type safety через `keyof`** (не ручные type aliases):
   ```typescript
   // Было
   type GoalExtractableField = "role" | "position" | "domains";

   // Стало
   const GOAL_FIELD_DESCRIPTIONS: Record<keyof TargetContext, string>
   ```

3. **Расширили extraction до всех полей:**
   - AdhocContextBase: 6 → 12 полей
   - TargetContext: 3 → 6 полей

---

## Фаза 3: Тестирование flow (DONE ранее)

Flow `adhoc → goal → search` работает корректно:
- Intent "хочу стать senior" → `clarify` (не `proceed`) ✅
- LLM merge pattern работает ✅
- NLP стиль дружелюбный ✅

---

## Что делать дальше

1. **Пересобрать facade** и протестировать после декомпозиции
2. **Edge cases:** полная смена контекста ("нет, я frontend")
3. **FEAT-046 Phase 2:** search modes (ask_search_mode node)

---

## Артефакты

- `src/facade/langGraph/search-graph/prompts/` — новая структура
- `src/facade/services/orchestrator/intent-classifier.ts` — Map → Record
- `src/facade/services/nlp-formatter/prompts.ts` — inline → Record

---

## Рефлексия

### Паттерн: Explicit arguments > Placeholders

| | |
|---|---|
| **Симптом** | `PROMPT.replace("{field}", value)` — неявная подстановка |
| **Первопричина** | Быстрее написать placeholder чем продумать API |
| **Правило** | Builder function с явными аргументами — IDE подсказывает, TypeScript проверяет |

### Паттерн: keyof > Manual type alias

| | |
|---|---|
| **Симптом** | `type Field = "a" | "b" | "c"` дублирует schema keys |
| **Первопричина** | Копировал поля вручную, не думал о связи с бизнес-типом |
| **Правило** | `keyof BusinessType` — single source of truth, TypeScript ловит рассинхрон |

---

## Промпт для rewind

```
Изучи sessions/2025-12-26-prompts-decomposition.md

КОНТЕКСТ:
- Ветка: feature/search-refactor
- Prompts decomposition DONE
- tsc ✅, lint ✅

ЧТО СДЕЛАНО:
- prompts.ts → prompts/{extraction, classification, advisor}.ts
- Builder functions с явными аргументами (не .replace())
- keyof BusinessType для type safety
- Расширили extraction до всех полей AdhocContextBase и TargetContext

ЧТО ДЕЛАТЬ:
1. npm run facade:rebuild && протестировать flow
2. Edge cases: смена контекста
3. FEAT-046 Phase 2: search modes

ПРИНЦИПЫ:
- Explicit arguments > placeholders
- keyof BusinessType > manual type aliases
- Decompose by responsibility
```
