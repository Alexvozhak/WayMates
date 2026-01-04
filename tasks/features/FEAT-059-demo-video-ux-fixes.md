# FEAT-059: Demo Video UX Fixes

**Статус:** READY_FOR_WORK
**Приоритет:** P0 (блокирует demo video)
**Дата:** 2025-01-04

---

## Бизнес-ценность

Demo video — ключевой артефакт для презентации продукта инвесторам и пользователям. Текущие UX проблемы:

1. **Сломанный flow после /start** — бот показывает кандидатов вместо confirm message, потому что pending interrupt от предыдущей сессии не очищается
2. **Inconsistent locale** — хардкод русского текста при английской локали пользователя
3. **Непонятные опции** — бот предлагает "explore" без объяснения что это, routing и prompt несинхронизированы
4. **Advisor не видит правильные данные** — для pathfinders показывает waymates, skills обрезаются
5. **Нет Vision для charts** — пользователь спрашивает про график, а LLM не видит его

**Цель:** Сделать demo video flow предсказуемым и понятным для пользователя.

---

## План работ

### Phase 1: Critical Flow Fixes (~50 LOC)

#### 1.1 Очистка checkpoint при /start
**Проблема:** Pending interrupt от предыдущей сессии resume-ится первым сообщением после /start.

**Решение:** Добавить очистку всех graph checkpoints при /start.

**Файлы:**
- `src/telegram-bot/handlers/start.ts` — добавить вызов cancelActiveGraphs

#### 1.2 Prompt консистентный с routing
**Проблема:** NLP prompt говорит "Offer: set goal or explore similar people", но routing поддерживает больше интентов (editAdhoc, ask). Prompt не различает случаи с целью и без.

**Решение:** Обновить prompt для confirming_adhoc_context — показывать опции в зависимости от hasGoal.

**Файлы:**
- `src/facade/services/nlp-formatter/prompts.ts` — строки 15-19

#### 1.3 Убрать хардкод русского в confirm-adhoc-context
**Проблема:** `buildConfirmMessage` содержит русский текст ("навыки:", "контекст не указан", "Окей..."), хотя locale может быть "en".

**Решение:** Убрать buildConfirmMessage — он не используется в финальном ответе (NLP formatter формирует текст). Оставить только structured data в interrupt.

**Файлы:**
- `src/facade/langGraph/search-graph/nodes/confirm-adhoc-context.ts`

---

### Phase 2: Locale Fixes (~20 LOC)

#### 2.1 i18n в document.ts
**Проблема:** Хардкод русского в Telegram handler для PDF upload.

**Решение:** Использовать существующий @grammyjs/i18n — добавить ключи в .ftl файлы.

**Файлы:**
- `src/telegram-bot/handlers/document.ts`
- `src/telegram-bot/locales/en.ftl`
- `src/telegram-bot/locales/ru.ftl`

---

### Phase 3: Advisor Data Fixes (~40 LOC)

#### 3.1 Rename searchResults → waymateResults
**Проблема:** Неочевидное название `searchResults` — на самом деле это waymates.

**Решение:** Переименовать для ясности.

**Файлы:**
- `src/facade/langGraph/search-graph/state.ts`
- `src/facade/langGraph/search-graph/nodes/*.ts` (все использования)
- `src/facade/langGraph/search-graph/response-builders.ts`

#### 3.2 Fix generate-answer для pathfinders
**Проблема:** `generate-answer.ts` использует `state.searchResults` всегда — это waymates. Для pathfinders нужен `state.pathfinderResults`.

**Решение:** Выбирать candidates по текущей фазе.

**Файлы:**
- `src/facade/langGraph/search-graph/nodes/generate-answer.ts`

#### 3.3 Skills limit constant
**Проблема:** Магическое число `slice(0, 4)` для skills.

**Решение:** Вынести в константу `ADVISOR_MAX_SKILLS_PER_CANDIDATE = 10`.

**Файлы:**
- `src/facade/langGraph/search-graph/advisor-context-builder.ts`

---

### Phase 4: Dictionary Questions (~40 LOC)

#### 4.1 questionType в ask schema
**Проблема:** Пользователь спрашивает "какие есть индустрии?" — бот не может ответить.

**Решение:** Расширить ask intent schema — добавить `questionType: "general" | "dictionary" | "candidate" | "chart"`. LLM сам определит тип. Для dictionary — инжектировать словари в advisor context.

**Файлы:**
- `src/facade/langGraph/search-graph/nodes/parse-intent.ts` — schema
- `src/facade/langGraph/search-graph/nodes/generate-answer.ts` — dictionary injection
- `src/facade/langGraph/search-graph/advisor-context-builder.ts` — addDictionaries method

---

### Phase 5: Vision для Charts (~90 LOC)

#### 5.1 Chart screenshotter service
**Проблема:** Пользователь спрашивает "почему линия #3 выше?" — LLM не видит график.

**Решение:** Для questionType="chart" — screenshot через Puppeteer, multimodal LLM call.

**Файлы:**
- `src/facade/services/chart-screenshotter.service.ts` (новый)
- `src/facade/langGraph/search-graph/nodes/generate-answer.ts`
- `src/facade/langGraph/search-graph/prompts/advisor.ts` — CHART_ANALYSIS_PROMPT

**Контекст для промпта:** Секция "4.8 DTW метрики" из `docs/mvp_final/BUSINESS-LOGIC-MVP.md`

---

## Файлы для обязательного чтения

### Документация
- `docs/mvp_final/BUSINESS-LOGIC-MVP.md` — секция 4.8 DTW метрики (для Vision prompt)
- `mvp-test-final/KNOWLEDGE-BASE.md` — архитектура search-graph
- `.claude/context/guidelines.md` — правила разработки

### Код (routing и state)
- `src/facade/langGraph/search-graph/search-router.ts` — CONFIRMING_NO_GOAL_ROUTES, CONFIRMING_WITH_GOAL_ROUTES
- `src/facade/langGraph/search-graph/state.ts` — фазы, интенты
- `src/facade/langGraph/search-graph/response-builders.ts` — что передаётся в NLP

### Код (NLP и prompts)
- `src/facade/services/nlp-formatter/prompts.ts` — SEARCH_PHASE_DESCRIPTIONS
- `src/facade/langGraph/search-graph/prompts/advisor.ts` — ADVISOR_SYSTEM_PROMPT
- `src/facade/langGraph/search-graph/prompts/classification.ts` — intent descriptions

### Код (nodes)
- `src/facade/langGraph/search-graph/nodes/confirm-adhoc-context.ts`
- `src/facade/langGraph/search-graph/nodes/generate-answer.ts`
- `src/facade/langGraph/search-graph/advisor-context-builder.ts`

### Код (Telegram)
- `src/telegram-bot/handlers/start.ts`
- `src/telegram-bot/handlers/document.ts`
- `src/telegram-bot/locales/*.ftl`

### Пример Vision
- `src/facade/mcp-server/tools/parse-cv-to-text.tool.ts` — как уже работает multimodal

---

## Acceptance Criteria

- [ ] После /start pending interrupts очищаются
- [ ] confirm_adhoc_context показывает опции консистентные с routing
- [ ] document.ts использует i18n
- [ ] generate-answer выбирает candidates по фазе (waymates/pathfinders/exploration)
- [ ] Skills limit вынесен в константу
- [ ] Вопросы про словари получают ответ с данными из БД
- [ ] Вопросы про chart получают ответ с Vision анализом

---

## Оценка

| Phase | LOC | Файлы |
|-------|-----|-------|
| 1. Critical Flow | ~50 | 3 |
| 2. Locale | ~20 | 3 |
| 3. Advisor Data | ~40 | 5+ |
| 4. Dictionary | ~40 | 3 |
| 5. Vision | ~90 | 3 |
| **Total** | **~240** | **~15** |

---

## Зависимости

- Puppeteer MCP уже подключен
- @grammyjs/i18n уже установлен и настроен
- Vision API работает (parse-cv-to-text.tool.ts)
