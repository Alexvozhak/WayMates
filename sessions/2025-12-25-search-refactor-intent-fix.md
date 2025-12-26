# Сессия: Search Refactor + Intent Classification Fix

**Дата**: 2025-12-25
**Ветка**: `feature/search-refactor` (от `feature/gds-module-1`)

---

## Фаза 1: Manual Testing — Intent Classification Bug

### Что сделано

1. **Обнаружен баг intent classification**
   - "хочу стать senior" классифицируется как `proceed` вместо `clarify`
   - Причина: в `USER_INTENT_PROMPT` описание PROCEED содержало "expresses a career goal"
   - Это неверно для фазы `confirming_adhoc_context` — там цель = новая информация = clarify

2. **Исследование архитектуры parse_search_intent**
   - Два уровня intent classification: orchestrator (ConverseTool) и graph-internal (parse_search_intent)
   - При resume активного графа orchestrator intent ИГНОРИРУЕТСЯ
   - `parseUserIntent(message)` НЕ получал phase context — это корень проблемы

3. **Решение (реализовано в предыдущей сессии)**
   - `parseUserIntent(message, phase)` — теперь принимает phase
   - `buildUserIntentPrompt(phase)` — генерирует промпт с PHASE_CONTEXT
   - `reasoning` поле в schema — для visibility в LangSmith

### Что сделать

- Протестировать fix через `mcp-chat.ts` с LangSmith tracing
- Проверить что "хочу стать senior" → clarify → extract_goal

---

## Фаза 2: Research — LLM Observability Tools

### Что сделано

1. **Исследован TruLens, LangSmith, Langfuse**
   - TruLens: feedback functions для semantic clarity
   - LangSmith: уже используется, Polly AI для debug, LangSmith Fetch CLI
   - Langfuse: prompt management

2. **Ключевой инсайт (Voiceflow research)**
   - Проблема: fuzzy definitions ("expresses a career goal" матчит слишком много)
   - Решение: structural requirements (goal + context + action = PROCEED)

3. **Рекомендация**
   - Добавить Chain-of-Thought (reasoning field) — СДЕЛАНО
   - Структурные определения интентов — СДЕЛАНО (PHASE_CONTEXT)
   - Regression тесты на intent classification — TODO

### Артефакты

- `waymates_trulens_demo.md` — демо концепт для TruLens
- Research: Voiceflow intent optimization, LangSmith debugging

---

## Фаза 3: Search Modes Refactoring — Phase 1 Complete

### Что сделано

1. **Фаза 1: reverseSearchPathfinders (rename)**
   - `buildTargetSearchWithPathsQuery` → `buildReversePathfinderSearchQuery`
   - `SearchManager.searchByTarget` → `reverseSearchPathfinders`
   - tRPC: `byTarget` → `reversePathfinders`
   - Обновлены facade nodes, MCP tools, integration tests
   - **Коммит**: `aeabdcf` на ветке `feature/search-refactor`

### Что сделать

2. **Фаза 2: searchWaymates (merge)**
   - Merge `searchAdhoc` + `searchByUser` → `searchWaymates`
   - Убрать dead code (goalPositions classification в buildCurrentSearchQuery)
   - Обновить tRPC: `adhoc` + `byUser` → `waymates`

3. **Фаза 3: Убрать chart из explore**
   - Waymates не имеют path — chart бессмысленен
   - Chart только для pathfinders/reversePathfinders

---

## Рефлексия (сквозная)

### Как делать правильно

1. **Уверенность 90%+ перед правками** — изучить бизнес-логику, понять ЗО компонентов
2. **Читать session logs предыдущих сессий** — контекст уже наработан
3. **Pre-Action Declaration** — описать проблему/решение/файл перед правкой
4. **Структурные определения интентов** — не fuzzy ("expresses goal"), а требования (goal + context + action)
5. **Phase context в intent classification** — значение интента зависит от фазы
6. **Rename = отдельный коммит** — минимальный риск, легко откатить

### Как делать неправильно

1. **Делать правки без понимания бизнес-логики** — "зачем?" важнее "как?"
2. **Игнорировать архитектурные инсайты из session logs** — там уже разобрано
3. **Fuzzy intent definitions** — LLM не может понять неоднозначные описания
4. **Рефакторить без regression тестов** — особенно для intent classification
5. **Смешивать rename с logic changes** — разные коммиты

### Инсайты

1. **Два уровня intent classification** — orchestrator (какой граф?) и graph-internal (куда внутри графа?)
2. **При resume orchestrator intent игнорируется** — граф использует свой parse_search_intent
3. **Phase context критичен** — "хочу senior" значит разное в разных фазах
4. **Chain-of-Thought для debug** — reasoning field показывает почему LLM выбрал intent
5. **3 режима поиска** — waymates (peers), pathfinders (FROM→TO), reversePathfinders (→TO)
6. **Chart требует path** — waymates не имеют path, chart для них бессмысленен

### Наставления от пользователя

1. **"уверенность 90%+"** — не делать правки пока не понял бизнес-логику
2. **"всю задачу пропускай через себя"** — не бездумные правки
3. **"читай session logs"** — контекст уже наработан, не изобретать заново
4. **"непредвзятая честная оценка"** — не угождать, а анализировать объективно
5. **"harder thinking"** — глубокий анализ, sequential-thinking для сложных решений

---

## Промпт для продолжения после rewind

```
Изучи: sessions/2025-12-25-search-refactor-intent-fix.md

КОНТЕКСТ:
- Ветка: feature/search-refactor (от feature/gds-module-1)
- Фаза 1 (rename reverseSearchPathfinders) — DONE, коммит aeabdcf
- Фаза 2 (searchWaymates) — IN_PROGRESS
- Фаза 3 (убрать chart из explore) — PENDING

СОСТОЯНИЕ:
- Intent classification fix уже реализован (PHASE_CONTEXT + reasoning)
- Нужно протестировать через mcp-chat.ts с LangSmith

ЧТО ДЕЛАТЬ:
1. Тест intent fix: npx tsx poc/mcp-chat.ts "хочу стать senior" — должен быть clarify
2. Фаза 2: merge searchAdhoc + searchByUser → searchWaymates
3. Фаза 3: убрать chart из explore.ts

Объём оставшейся работы: ~150 LOC
```
