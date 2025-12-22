# Сессия: Career Advisor Mode Design + Implementation

**Дата**: 2025-12-22
**Ветка**: feature/gds-module-1
**Статус**: ✅ ЗАВЕРШЕНО — все тесты проходят (16/16)

---

## Фаза 1: Анализ и дизайн

### Что сделано

1. **Анализ двух архитектурных вопросов:**
   - Cold-Start → Search transition: работает корректно через intent classification, мост не нужен
   - Post-Search RAG: не поддерживается — это architectural gap, требует нового Advisor Mode

2. **Изучение архивных документов** (9 docs из `docs/business/_archive/`):
   - Проанализированы оригинальные концепции: CCP, Tempo, Subgoals, Distance/Speed
   - Создан `docs/analysis/ORIGINAL-VISION-ANALYSIS.md` — сводка что реализовано/не реализовано

3. **Дизайн Advisor Mode v3** (финальный):
   - Новая фаза `advising` с multi-turn Q&A loop
   - 2 новых nodes: `answer_question`, `parse_advisor_intent`
   - 2 интента: `ask` (продолжить), `done` (завершить)
   - ~150 LOC

4. **Создан план реализации:**
   - `docs/facade/ADVISOR-MODE-IMPLEMENTATION.md` — 7 фаз, DoD, примеры диалогов
   - Включено DTW объяснение для промпта (формулы, интерпретация)

### Ключевые артефакты

| Файл | Описание |
|------|----------|
| `docs/analysis/ORIGINAL-VISION-ANALYSIS.md` | Анализ оригинального видения vs текущая реализация |
| `docs/facade/ADVISOR-MODE-IMPLEMENTATION.md` | План реализации Advisor Mode (~150 LOC) |

### Что делать следующим

1. **Реализовать Advisor Mode** по плану:
   - Фаза 1: Types & State (state.ts)
   - Фаза 2: Advisor Prompt (prompts.ts)
   - Фаза 3: Nodes (answer-question.ts, parse-advisor-intent.ts)
   - Фаза 4-7: Routing, Wiring, Schema, Builder

2. **Запустить `/mvp-implement`** с планом `docs/facade/ADVISOR-MODE-IMPLEMENTATION.md`

---

## Рефлексия (сквозная)

### Как делать правильно

1. **Терминологию интегрировать в промпт, не в отдельный glossary** — DRY, меньше файлов
2. **Zod схемы не дублировать в промпте** — указывать только ключевые поля для анализа
3. **UX после консультации: done → END** — не "back to results", пользователь начнёт новый диалог с новым intent
4. **DTW объяснять математически** — формулы + интерпретация + примеры в промпте

### Как делать неправильно

1. ❌ Дублировать структуру zod схем в промпте
2. ❌ Добавлять "back to results" с повторным выводом кандидатов
3. ❌ Создавать отдельный glossary когда можно встроить в промпт
4. ❌ Добавлять шильдики ради терминологии (когорта = `candidateType: null`)

### Инсайты

1. **Feedback field — золото для Advisor:**
   - `context.feedback` — рефлексия о переходе
   - `trail.userFeedback` — рефлексия об обучении
   - Отвечает на "стоила ли игра свеч?"

2. **path + trails = полная траектория:**
   - `path: UserContext[]` — все контексты
   - `trails: Trail[]` — все тропы между контекстами
   - Advisor может анализировать весь путь кандидата

3. **Advising — терминальная фаза:**
   - После `done` граф завершается
   - Новое сообщение → ConverseTool → classifyIntent → новый граф
   - Это проще чем сложный routing внутри advising

### Наставления от пользователя

| Наставление | Вывод |
|-------------|-------|
| "Zod схемы не дублировать" | Указывать в промпте только ключевые поля, не структуру |
| "Зачем снова выводить кандидатов?" | Убрать "back to results", оставить только ask/done |
| "Промпт должен объяснять DTW математически" | Добавить формулы + интерпретацию + примеры |
| "Feedback есть в контекстах" | Использовать для ответов на "стоила ли игра свеч?" |

---

## Фаза 2: Реализация Advisor Mode

### Что сделано

1. **State extensions** (state.ts):
   - Фаза `advising` (переименована с `asking_advisor`)
   - NODE: `answer_question`, `parse_advisor_intent`
   - SearchUserIntent: добавлен `ask`
   - AdvisorIntent type: `ask | done`
   - State fields: `advisorIntent`, `advisorQuestion`, `currentAnswer`
   - OPTIONS.advising: `["ask more", "done"]`

2. **Prompts** (prompts.ts):
   - `ADVISOR_SYSTEM_PROMPT` — терминология, DTW метрики с формулами, правила ответов
   - `ADVISOR_INTENT_PROMPT` — классификация ask/done

3. **AdvisorContextBuilder** (advisor-context-builder.ts):
   - Fluent API для сборки контекста
   - Compact format (экономия токенов)
   - Методы: `addUserTrajectory`, `addUserContext`, `addGoal`, `addCandidates`, `addCandidateDetails`, `addChart`

4. **Nodes**:
   - `answer-question.ts` — генерирует ответ через LLM, interrupt
   - `parse-advisor-intent.ts` — парсит ask/done

5. **Routing** (search-router.ts):
   - `ask: NODE.answer_question` в showing_results
   - `ADVISOR_ROUTE_MAP`
   - `routeAfterAdvisor`

6. **Graph wiring** (search-graph.ts):
   - Импорты и nodes добавлены
   - Edges: `answer_question → parse_advisor_intent → (ask: loop, done: END)`

7. **Response builder** (response-builders.ts):
   - Builder для `PHASE.advising`

### Что делать следующим

1. **Запустить quality checks**:
   ```bash
   npm run lint:fix
   npx tsc --noEmit
   ```

2. **Исправить ошибки** (если будут)

3. **Написать integration test** для happy path:
   - showing_results → ask question → advising → ask more → advising → done → END

### Ключевые артефакты этой фазы

| Файл | Что сделано |
|------|-------------|
| `src/facade/langGraph/search-graph/state.ts` | +20 LOC (types, fields) |
| `src/facade/langGraph/search-graph/prompts.ts` | +55 LOC (ADVISOR prompts) |
| `src/facade/langGraph/search-graph/advisor-context-builder.ts` | NEW ~100 LOC |
| `src/facade/langGraph/search-graph/nodes/answer-question.ts` | NEW ~45 LOC |
| `src/facade/langGraph/search-graph/nodes/parse-advisor-intent.ts` | NEW ~40 LOC |
| `src/facade/langGraph/search-graph/search-router.ts` | +15 LOC |
| `src/facade/langGraph/search-graph/search-graph.ts` | +10 LOC |
| `src/facade/langGraph/search-graph/response-builders.ts` | +5 LOC |

---

## Рефлексия (сквозная)

### Как делать правильно

1. **Терминологию интегрировать в промпт, не в отдельный glossary** — DRY, меньше файлов
2. **Zod схемы не дублировать в промпте** — указывать только ключевые поля для анализа
3. **UX после консультации: done → END** — не "back to results", пользователь начнёт новый диалог с новым intent
4. **DTW объяснять математически** — формулы + интерпретация + примеры в промпте
5. **Builder Pattern для контекста LLM** — fluent API, переиспользуемый, токен-эффективный
6. **Траектория > контекст** — если есть userTrajectory, использовать её вместо userContext
7. **90%+ уверенность перед кодированием** — сначала blueprint, потом код

### Как делать неправильно

1. ❌ Дублировать структуру zod схем в промпте
2. ❌ Добавлять "back to results" с повторным выводом кандидатов
3. ❌ Создавать отдельный glossary когда можно встроить в промпт
4. ❌ Ручной парсинг с JSON.stringify — это велосипед
5. ❌ String concatenation для сложных промптов — использовать Builder
6. ❌ Начинать код без понимания существующих паттернов — сначала grep/read

### Инсайты

1. **Feedback field — золото для Advisor:**
   - `context.feedback` — рефлексия о переходе
   - `trail.userFeedback` — рефлексия об обучении
   - Отвечает на "стоила ли игра свеч?"

2. **path + trails = полная траектория:**
   - `path: UserContext[]` — все контексты
   - `trails: Trail[]` — все тропы между контекстами
   - Advisor может анализировать весь путь кандидата

3. **Advising — терминальная фаза:**
   - После `done` граф завершается
   - Новое сообщение → ConverseTool → classifyIntent → новый граф
   - Это проще чем сложный routing внутри advising

4. **Builder Pattern для LLM контекста** (из Explore agent research):
   - Token efficiency: compact format экономит 40%
   - Markdown > JSON для LLM (92% accuracy vs 95%, но 2x меньше токенов)
   - Fluent API читаемее чем template literals

### Наставления от пользователя

| Наставление | Вывод |
|-------------|-------|
| "Zod схемы не дублировать" | Указывать в промпте только ключевые поля, не структуру |
| "Зачем снова выводить кандидатов?" | Убрать "back to results", оставить только ask/done |
| "Промпт должен объяснять DTW математически" | Добавить формулы + интерпретацию + примеры |
| "Feedback есть в контекстах" | Использовать для ответов на "стоила ли игра свеч?" |
| "Ручной парсинг — зло, запусти Explore" | Builder Pattern вместо string concatenation |
| "Траектория, а не только текущий контекст" | userTrajectory для DTW сравнения |
| "90%+ уверенность перед кодом" | Blueprint → проверка паттернов → реализация |

---

## Фаза 3: Bug-fix и финальная проверка

### Что сделано

1. **Исправлены lint ошибки**:
   - `advisor-context-builder.ts`: complexity 11/9 → рефакторинг через helpers (`formatGoalPart`, `formatDtwLine`, etc.)
   - `search-router.ts`: удалён unused import `AdvisorIntent`
   - Добавлены поля countries/languages в `addGoal()` (было только 4 из 6)

2. **Критический bug-fix: Two-Node Pattern**:
   - **Проблема**: `interrupt()` прерывает выполнение, `return` не достигается → `state.currentAnswer` пустой
   - **Решение**: Разделить на 2 node:
     - `generate_answer` — бизнес-логика, сохраняет в state, БЕЗ interrupt
     - `show_answer` — interrupt, читает ответ из state
   - Переименован `answer_question` → `generate_answer`

3. **Обновлены все routing и edges**:
   - `state.ts`: +NODE.show_answer
   - `search-router.ts`: NODE.answer_question → NODE.generate_answer
   - `search-graph.ts`: `generate_answer → show_answer → parse_advisor_intent`

4. **Написаны integration tests** (3 test cases):
   - TC-SG-ADV1: Вопрос из showing_results → advising
   - TC-SG-ADV2: Multi-turn диалог (loop)
   - TC-SG-ADV3: Выход через "done" → cancelled

5. **Все 16 search-graph тестов проходят**

### Финальная архитектура

```
showing_results (interrupt)
       │
       └── "ask" ───────────▶ generate_answer (бизнес-логика)
                                     │
                                     ▼ (saves currentAnswer to state)
                              show_answer (interrupt)
                                     │
                                     ▼
                            parse_advisor_intent
                                     │
              ┌──────────────────────┼──────────────────┐
              ▼                      ▼                  ▼
           "back"                 "ask"              "done"
              │                      │                  │
              ▼                      ▼                  ▼
        show_results          generate_answer        cancel
                                (loop)               → END
```

### Финальные файлы

| Файл | Статус |
|------|--------|
| `nodes/generate-answer.ts` | NEW ~45 LOC |
| `nodes/show-answer.ts` | NEW ~25 LOC |
| `nodes/parse-advisor-intent.ts` | ~40 LOC |
| `advisor-context-builder.ts` | ~120 LOC (refactored) |
| `tests/.../advisor-mode.integration.ts` | NEW ~215 LOC |

### Что делать следующим

1. **Коммит изменений** (если требуется)
2. **PR review** для Advisor Mode feature
3. **Добавить tests для edge cases** (optional):
   - Gibberish input в advising
   - Empty searchResults

---

## Рефлексия (обновлённая)

### Как делать правильно

1. **Two-Node Pattern для interrupt + business logic** — генерация и показ должны быть отдельными nodes
2. **Читать lessons-learned.md ПЕРЕД реализацией** — там уже есть решения типичных проблем
3. **Builder Pattern для контекста LLM** — fluent API, переиспользуемый, токен-эффективный
4. **Траектория > контекст** — если есть userTrajectory, использовать её вместо userContext
5. **90%+ уверенность перед кодированием** — сначала blueprint, потом код
6. **Детальные JSDoc комментарии на русском** — "Что тестируем:", "Инвариант:", "Flow:", "Then:"
7. **Проверять ESLint complexity ПОСЛЕ написания кода** — вынести helpers если complexity > 8

### Как делать неправильно

1. ❌ **interrupt() в одном node с бизнес-логикой** — return не выполнится, state не обновится
2. ❌ Дублировать структуру zod схем в промпте
3. ❌ Начинать код без понимания существующих паттернов — сначала grep/read
4. ❌ Игнорировать lessons-learned.md — там решены типичные проблемы

### Инсайты этой фазы

1. **Interrupt прерывает выполнение** — return statement после interrupt не достигается сразу. State обновляется только после resume.

2. **Two-Node Pattern — стандарт для LangGraph interrupt:**
   - Node 1 (business): делает работу, сохраняет в state
   - Node 2 (interrupt): читает из state, делает interrupt
   - Пример: `generate_answer → show_answer`

3. **ESLint complexity 8 — жёсткое ограничение:**
   - Вынести helpers как top-level functions
   - Не пытаться обойти — рефакторить

### Наставления от пользователя (обновлённые)

| Наставление | Вывод |
|-------------|-------|
| "A: Два node (Recommended)" | Разделять бизнес-логику и interrupt в разные nodes |
| "Бизнес-комменты на русском, детальней" | JSDoc формат: Что тестируем, Инвариант, Flow, Then |
| "Смущает 4 поля goal" | Проверять schema и добавлять ВСЕ поля |
| "type: advising — без литерала?" | Консистентно с другими nodes — обычный string |

---

## Полезные ссылки

- [Advisor Mode Implementation Plan](../docs/facade/ADVISOR-MODE-IMPLEMENTATION.md)
- [Original Vision Analysis](../docs/analysis/ORIGINAL-VISION-ANALYSIS.md)
- [DTW Trajectory Matching](../docs/business/_archive/DTW_TRAJECTORY_MATCHING.md)
- [SearchGraph code](../src/facade/langGraph/search-graph/)
- [LangGraph Architecture Principles](../.claude/routers/langgraph/architecture-principles.md)
- [LangGraph Lessons Learned](../.claude/routers/langgraph/lessons-learned.md)
- [Guidelines](../.claude/context/guidelines.md)

---

## Промпт для Rewind

Если сессия откатана и нужно быстро войти в контекст:

```
Продолжаем сессию Advisor Mode.

Контекст: sessions/2025-12-22-advisor-mode-design.md

Статус: ✅ ЗАВЕРШЕНО
- Все 16 search-graph тестов проходят
- Код готов к коммиту

Ключевой инсайт сессии: Two-Node Pattern — `generate_answer` (бизнес-логика) + `show_answer` (interrupt). Interrupt прерывает выполнение, поэтому сохранение в state должно быть в отдельном node.

Что делать: [опиши свою задачу]
```
