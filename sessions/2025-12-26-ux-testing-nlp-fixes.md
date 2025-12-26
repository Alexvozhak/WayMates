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

## Фаза 3: Router Refactor (IN PROGRESS)

**Что сделано:**
- Добавлен `ask` intent во все фазы (PHASE_CONTEXT + routing)
- Извлечены статические routes в константы (EXPLORATION_ROUTES, SEARCH_MODE_ROUTES, RESULTS_ROUTES)

**Осталось:**
- Проверить tsc + lint
- Rebuild facade и финальный тест

---

## Ключевые инсайты

### `ask` intent должен быть везде

Пользователь может спросить "что ты умеешь?" или "а что дальше?" в любой фазе. Без `ask` в valid intents → LLM классифицирует как `cancel`.

### Инструкции в промпте видны всем фазам

Все описания фаз в одном SEARCH_PROMPT. Если в одной фазе сказано "Ask for X", LLM может применить это к другой фазе. Решение: семантические инструкции без конкретных полей.

### Static vs Dynamic routes

Routes без зависимости от flags → выносить в константы (UPPER_CASE). Routes с flags → внутри функции.

---

## Отчёт по багам

См. `docs/mvp_final/tests_report.md`

---

## Что делать дальше

1. `npx tsc --noEmit` + `npm run lint:fix`
2. `npm run facade:rebuild`
3. Финальный прогон flow: adhoc → goal → search → results
4. Коммит если всё ок

---

## Промпт для rewind

```
Изучи sessions/2025-12-26-ux-testing-nlp-fixes.md

КОНТЕКСТ:
- Ветка: feature/search-refactor
- UX тестирование как токсичный пользователь
- 7 NLP багов найдено и исправлено
- Router refactor: статические routes вынесены в константы

СТАТУС:
- tsc/lint не проверены после последнего изменения
- facade не пересобран

ЧТО ДЕЛАТЬ:
1. npx tsc --noEmit && npm run lint:fix
2. npm run facade:rebuild
3. Финальный тест полного flow
4. Коммит
```
