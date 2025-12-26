# Session Log: UX Testing + NLP Fixes

**Дата:** 2025-12-26
**Ветка:** `feature/search-refactor`
**Статус:** IN PROGRESS

---

## Контекст

Ручное UX тестирование SearchGraph как токсичный пользователь. Критерии: переспросы, непонятные ответы, диалог как с больным.

---

## Фаза 1: Position Extraction Fix (DONE)

**Проблема:** "джун с 4 годами опыта" → LLM возвращал `middle`, игнорируя explicit.

**Причина:** POSITION FALLBACK по годам применялся даже при явном указании грейда.

**Fix:** Убран fallback, position извлекается только если явно сказан.

**Файл:** `src/facade/langGraph/search-graph/prompts/extraction.ts`

---

## Фаза 2: NLP Prompts Fixes (DONE)

7 UX багов найдено и исправлено:

| # | Фаза | Проблема | Fix |
|---|------|----------|-----|
| 1 | asking_adhoc_context | "aiming for" путал с целью | Спрашивать CURRENT level |
| 2 | showing_goal | Молчаливое наследование полей | Явно сказать что унаследовано |
| 3 | showing_results (0) | Нет объяснения почему пусто | Показать applied filters |
| 4 | asking_search_mode | Jargon, много текста | Упростить описания |
| 5 | extraction | Игнорировал explicit position | Убрать fallback |
| 6 | confirming_adhoc_context | Переспрашивал заполненное | "DO NOT ask from FILLED" |
| 7 | все фазы | "что умеешь?" → cancel | Добавить `ask` intent везде |

**Файлы:**
- `src/facade/services/nlp-formatter/prompts.ts`
- `src/facade/langGraph/search-graph/prompts/classification.ts`
- `src/facade/langGraph/search-graph/search-router.ts`

---

## Фаза 3: Router Refactor (DONE)

- Добавлен `ask` intent во все фазы (PHASE_CONTEXT + routing)
- Извлечены статические routes в константы (EXPLORATION_ROUTES, SEARCH_MODE_ROUTES, RESULTS_ROUTES)
- Коммит: `a5b0d1f`

---

## Фаза 4: Advisor Action Intent (DONE)

**Проблема:** Из advisor нельзя вернуться в main flow. "хочу стать senior" классифицировался как `ask` и зацикливался.

**Решение:** Generic `action` intent вместо дублирования интентов.

### Архитектура

```
advisor
   │
   ├─ ask → generate_answer (продолжить Q&A)
   ├─ action → parse_search_intent (вернуться в main flow)
   └─ done → show_results (закончить)
```

**Ключевой инсайт:** `action` = generic intent. Мы НЕ определяем КАКОЕ действие в advisor, просто понимаем что это действие (не вопрос). Main flow разберётся через parse_search_intent.

### Изменённые файлы

| Файл | Изменение |
|------|-----------|
| `state.ts` | + `action` в AdvisorIntent, + `previousPhase` |
| `prompts/advisor.ts` | Type-safe ADVISOR_INTENT_DESCRIPTIONS |
| `parse-advisor-intent.ts` | Schema + сохранение userResponse для action |
| `generate-answer.ts` | Сохранение previousPhase при входе в advisor |
| `search-router.ts` | action → parse_search_intent |
| `parse-search-intent.ts` | effectivePhase = previousPhase когда advising |
| `nlp-formatter/prompts.ts` | "CURRENT professional profile, not career goals" |

### Протестировано

```
confirming_adhoc_context → ask → advising → action → showing_goal ✅
```

---

## Ключевые инсайты

### `ask` intent должен быть везде

Пользователь может спросить "что ты умеешь?" в любой фазе. Без `ask` в valid intents → LLM классифицирует как `cancel`.

### Advisor как layer, не destination

Advisor должен уметь вернуть пользователя в main flow. Для этого нужен `previousPhase` чтобы parse_search_intent знал какой route map использовать.

### Generic action vs дублирование интентов

Вместо добавления setGoal, filter, explore в advisor (дублирование!) — один generic `action` который роутит в parse_search_intent с сохранённым userResponse.

### INTERRUPT ноды всегда ждут

Нельзя роутить из advisor в confirm_adhoc_context — там interrupt() снова остановит flow. Нужен прямой путь в parse_search_intent.

---

## Осталось сделать

1. **lint + commit** — изменения не закоммичены
2. **Test ask intent** — business/arch/user topics из разных фаз
3. **Structurizr research** — интеграция для архитектурных диаграмм
4. **Charts** — waymates, pathfinders, reverseSearch

---

## Промпт для rewind

```
Изучи sessions/2025-12-26-ux-testing-nlp-fixes.md

КОНТЕКСТ:
- Ветка: feature/search-refactor
- Advisor action intent реализован — возврат из advisor в main flow через previousPhase

СТАТУС:
- tsc ✅, lint не запущен
- facade пересобран, тесты прошли
- коммит НЕ сделан

ЧТО ДЕЛАТЬ:
1. npm run lint:fix && git add -A && git commit
2. Test ask intent из разных фаз (business/arch/user topics)
3. Structurizr research
4. Charts implementation (waymates, pathfinders, reverseSearch)
```
