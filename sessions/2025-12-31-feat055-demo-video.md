# Session: FEAT-055 Demo Video

**Дата:** 2025-12-31
**Фокус:** Подготовка демо видео для pre-seed — фикстуры, DTW, batch тесты, CV парсинг

---

## Сделано

### Phase 1-6.3: Завершено в предыдущих сессиях

- 10 demo фикстур созданы
- DTW unit test прошёл
- demo-adhoc.yaml 9/9 ✅
- setGoal routing bug fix
- Dictionary/fixtures mismatch fixes
- `DEFAULT_EXCLUDED_CONTEXT_FIELDS` добавлен

### Phase 6.4: countryCode + editContextNode fix ✅

- `normalizer.ts` — `.toUpperCase()` для countryCode/citizenships
- `prompts.ts` — добавлено "UPPERCASE"
- `edit-context.ts` — добавлен `normalizeFullContext()`
- **Результат:** demo-cold-start.yaml 15/15 ✅

### Phase 6.5: citizenships через relationships ✅

**Проблема:** `citizenships` отсутствовал в `contextFieldSchema` и был inconsistent — хранился как свойство ноды `context.citizenships` вместо relationships как domains/languages.

**Решение:** Полная миграция citizenships на relationships (консистентно с domains/skills/languages):

| Файл | Изменение |
|------|-----------|
| `src/shared/schemas.ts:511` | Добавлен `"citizenships"` в `contextFieldSchema` |
| `src/core/selectivity.service.ts` | Добавлен citizenships в explainPatterns + getContextFieldValue |
| `src/cypher/helpers/relationships.ts` | Добавлен `OPTIONAL MATCH (context)-[:CITIZEN_OF]->(Citizenship:Country)` |
| `src/cypher/helpers/aggregation.ts` | Добавлен `collect(DISTINCT ${prefix}Citizenship.name) AS ${prefix}Citizenships` |
| `src/cypher/helpers/scoring.ts` | Добавлен `matchedCitizenships` / `refCitizenships` в VARS |
| `src/cypher/helpers/filters.ts` | Исправлен `citizenships: { path: "matchedCitizenships" }` + STRICT_CONDITION_GENERATORS |
| `src/cypher/queries/search.ts` | Добавлен `matchedCitizenships` / `refCitizenships` во все WITH statements |
| `src/cypher/constants/projections.ts` | Изменён `.citizenships` → `citizenships: ${prefix}Citizenships` |

### Phase 6.6: Pathfinder search fix ✅ (текущая сессия)

**Проблема 1:** `matchedCitizenships` / `refCitizenships` не передавались в WITH statements в `src/cypher/queries/search.ts`

**Симптом:** Neo4j error `Variable 'matchedCitizenships' not defined` при pathfinder search

**Решение:** Добавлены недостающие переменные в 4 места:
1. `buildExcludedReasonsFilter` — добавлен `matchedCitizenships`
2. `buildSkillsScoringBlock` (waymates) — добавлен `matchedCitizenships`
3. `buildWithCollect` (refContext) — добавлен `matchedCitizenships`
4. `buildSkillsScoringBlock` (pathfinders) — добавлены `matchedCitizenships` и `refCitizenships`

**Проблема 2:** Фикстуры 0003, 0004 имели citizenships UA/DE в reference context вместо RU

**Симптом:** Только 2 из 4 pathfinders матчились (strict matching по citizenships)

**Решение:** Исправлены фикстуры — все 4 pathfinders теперь имеют RU citizenships в reference context

**Результат:** Neo4j query находит 4 pathfinders (0001-0004) ✅

### Phase 6.7: Target context role mismatch ✅

**Проблема:** Goal extraction возвращает `role: "manager"`, но фикстуры target context (head of engineering) имели `role: "architect"`

**Симптом:** Pathfinder search возвращает 0 результатов при batch test, хотя Neo4j query напрямую находит 4

**Корневая причина:** Strict matching по role в WHERE clause:
```cypher
matchedRole.canonicalName IN ['manager']  -- goal
-- vs фикстуры: role = 'architect'
```

**Решение:** Изменён role в target context (head of engineering) с "architect" на "manager" в 6 фикстурах:
- Demo-IdealPathfinder.json
- Demo-SprintPathfinder.json
- Demo-AltRoutePathfinder.json
- Demo-DirectPathfinder.json
- Demo-PMToFounder.json
- Demo-DSToFounder.json

**Результат:** demo-cold-start.yaml 15/15 ✅, chartUrl работает ✅

### Phase 6.8: Waymates goals + верификация данных ✅

**Проблема:** Waymates фикстуры (0005-0008) не имели Goal в Neo4j — waymates search не мог их найти

**Решение:** Создан script `scripts/setup-waymate-goals.ts` который устанавливает Goal для 4 waymates

**Верификация Neo4j (все 10 demo фикстур):**

| Тип | ID | Критерии матчинга | Статус |
|-----|----|-------------------|--------|
| Pathfinders | 0001-0004 | ref ≈ мой контекст (TPM, RU) → target = моя цель (HoE, NL) | ✅ 4/4 |
| Waymates | 0005-0008 | current ≈ мой контекст + goal = моя цель | ✅ 4/4 |
| Reverse Pathfinders | 0009-0010 | ref ≠ мой контекст → target = моя цель (HoE, NL) | ✅ 2/2 |

---

## Обнаруженные проблемы

### 1-4: ✅ FIXED (предыдущие сессии)

### 5. Goal хранится как JSON blob (tech debt)

**Факт:** `(:Goal {targetContext: '{"position":...}'})` — JSON string
**Создан:** `tasks/features/FEAT-057-goal-graph-storage.md`

### 6. citizenships в WITH statements ✅ FIXED (Phase 6.6)

**Корневая причина:** При добавлении citizenships в relationships, не все WITH statements были обновлены — пропущены в scoring block и excludedReasonsFilter.

---

## Осталось сделать

### Критично (для демо) — ВСЁ В Neo4j ✅

- [x] demo-cold-start.yaml — 15/15 ✅
- [x] chartUrl работает ✅
- [x] citizenships добавлен в search ✅
- [x] Pathfinder query исправлен (WITH statements) ✅
- [x] Фикстуры исправлены (citizenships RU) ✅
- [x] Neo4j query находит 4 pathfinders ✅
- [x] Target context role fix (architect → manager) ✅
- [x] Batch test прошёл 15/15 ✅
- [x] Waymates goals установлены ✅
- [x] Neo4j верификация: 10/10 фикстур ✅

### Phase 6.9: Integration tests for demo fixtures ✅

**Проблемы найдены и исправлены:**

1. **DEMO-PF (0 results → 4 results):**
   - Test params не соответствовали fixture: `domains: ["backend", "platform"]` vs fixture `["management", "backend"]`, `industry: "finance"` vs `"fintech"`
   - Fix: Исправил `ALEX_REFERENCE_CONTEXT` в тесте

2. **DEMO-WM (2 results → 4 results, isWaymate: true):**
   - Alex не имел Goal в Neo4j — waymates search не мог сравнивать goals
   - Fix: Добавил `goalsManager.setGoal()` для Alex в driver
   - educationLevel — strict field, не был в excludedContextFields
   - Fix: Заменил хардкод на `DEFAULT_EXCLUDED_CONTEXT_FIELDS`

**Результаты после исправлений:**
- DEMO-PF: ✅ 4/4 pathfinders
- DEMO-WM: ✅ 4/4 waymates (all isWaymate: true)
- DEMO-RP: ✅ 6 results (4 pathfinders + 2 reverse)

**Изменённые файлы:**
- `tests/core/integration/search-manager/demo-fixtures.integration.ts` — import + excludedContextFields
- `tests/core/helpers/drivers/demo-fixtures-driver.ts` — Goal для Alex

### TODO: Следующие шаги

- [x] ~~Создать batch test~~ → заменён на integration test demo-fixtures.integration.ts ✅
- [x] ~~Phase 6.10: Рефакторинг advisor flow~~ — объединение parse_advisor_intent в parse_search_intent ✅
- [ ] **Phase 6.11: Финализация рефакторинга** — tsc + lint + обновить advisor-mode.integration.ts
- [ ] **Phase 7: grammY e2e tests** — реальный Telegram с PDF
- [ ] Записать Video 1 (adhoc, ≤3.5 мин)
- [ ] Записать Video 2 (cold-start + DTW + PDF, ≤5.5 мин)

### Phase 6.10: Рефакторинг advisor flow ✅ (текущая сессия)

**Мотивация:** Два парсера intent (parse_search_intent + parse_advisor_intent) — избыточная сложность.

**Что сделано:**
1. Удалена фаза `advising` из `searchPhaseSchema`
2. Удалён `parse_advisor_intent` node из графа
3. Удалён `AdvisorIntent` type и `advisorIntent` из state
4. Добавлен `done` intent в `SIMPLE_INTENTS`
5. Обновлён routing: `show_answer → parse_search_intent` (вместо `parse_advisor_intent`)
6. Обновлены `RESULTS_ROUTES` с `done: NODE.show_results`
7. `generate_answer` больше не меняет phase — остаётся `showing_*_results`
8. `show_answer` использует `type: "show_answer"` вместо `type: "advising"`
9. Удалён `ADVISOR_INTENT_PROMPT` из экспорта
10. Удалён `advising` из `nlp-formatter/prompts.ts`

**Изменённые файлы:**
| Файл | Изменение |
|------|-----------|
| `state.ts` | Удалён `advising` из phases, удалён `AdvisorIntent`, добавлен `done` в intents |
| `search-router.ts` | Удалён `ADVISOR_ROUTE_MAP`, `routeAfterAdvisor`; `done` в RESULTS_ROUTES |
| `search-graph.ts` | Удалён import/node `parseAdvisorIntentNode`, edge `show_answer → parse_search_intent` |
| `generate-answer.ts` | Не меняет phase, убран previousPhase logic |
| `show-answer.ts` | `type: "show_answer"`, phase не меняется |
| `show-results.ts` | Убрана advising restore logic |
| `parse-search-intent.ts` | Убран effectivePhase logic |
| `response-builders.ts` | Убран advising builder, previousPhase из exploration |
| `prompts/advisor.ts` | Убран ADVISOR_INTENT_PROMPT |
| `prompts/index.ts` | Убран экспорт ADVISOR_INTENT_PROMPT |
| `prompts/classification.ts` | Добавлен `done` intent description |
| `nlp-formatter/prompts.ts` | Убран `advising` phase description |
| Удалён: `nodes/parse-advisor-intent.ts` | — |

**Результат:** 23 nodes вместо 24, 20 phases вместо 21, один парсер intent.

### Phase 6.11: Финализация рефакторинга ✅

**Выполнено:**
- [x] Исправлен `show-answer.ts` — `type: "show_answer"` вместо `type: "advising"`
- [x] Исправлен `prompts/index.ts` — убран экспорт `ADVISOR_INTENT_PROMPT`
- [x] Исправлен `nlp-formatter/prompts.ts` — убран `advising` phase description
- [x] Обновлена schema в `schemas.ts` — убран `advising` response type, добавлен `answerText` в results
- [x] Обновлён `advisor-mode.integration.ts` — тесты проверяют `answerText` через results phase
- [x] `npm run lint:fix && npx tsc --noEmit` ✅
- [x] `advisor-mode.integration.ts` — 3/3 ✅
- [x] `demo-adhoc.yaml` — 9/9 ✅

**Ключевое решение (вариант C):**
- `answerText` добавляется в response для `showing_*_results` phases
- Advisor ответ доступен через phase результатов, не отдельную фазу
- Тесты проверяют `response.answerText` при phase = `showing_pathfinder_results`

**UX для пользователя:** Ничего не изменилось — бот отвечает так же, показывает то же самое.

### Phase 6.12: Test helpers + searchWaymates fix ✅ (текущая сессия)

**Проблема 1:** `RELAXED_FILTERS` в тестах исключал `countryCode, languages` — нечестное тестирование.

**Решение:** Заменён на `DEFAULT_EXCLUDED_CONTEXT_FIELDS` + `DEFAULT_RECENCY_THRESHOLD_MONTHS`.

**Изменённые файлы:**
- `tests/facade/agents/search-graph/helpers/search-graph-helpers.ts`

**Проблема 2:** `searchWaymates` в profile mode искал только по `currentContextId` кандидата.

**Симптом:** DEMO-EXPLORE возвращал 4 вместо 8 — pathfinders не найдены (их current = head of engineering, не TPM).

**Корневая причина:** `filterByCurrentContext = true` в profile mode → Cypher: `matchedContext.contextId = matchedUser.currentContextId`.

**Бизнес-логика (правильная):** Ищем людей у которых ЕСТЬ похожий контекст **в траектории** (любой), не только current. `recency` ограничивает давность matched контекста.

**Решение:** `filterByCurrentContext = false` всегда в `searchByContext()`.

**Изменённые файлы:**
- `src/core/search-manager.ts:74` — `false` вместо `isProfileMode`

**Проблема 3:** Alex goal устанавливался в driver `beforeAll` — все тесты начинали с goal.

**Решение:** Убрана установка Alex goal из driver. Каждый тест управляет goal сам через `goalsManager.setGoal/deleteGoal`.

**Изменённые файлы:**
- `tests/core/helpers/drivers/demo-fixtures-driver.ts` — убран setGoal для Alex, экспортирован `goalsManager`
- `tests/core/integration/search-manager/demo-fixtures.integration.ts` — каждый тест управляет goal

**Результаты demo-fixtures.integration.ts:**
- DEMO-EXPLORE: 8 ✅ (4 pathfinders + 4 waymates)
- DEMO-RP: 6 ✅ (4 pathfinders + 2 reverse)
- DEMO-WM: 4 ✅
- DEMO-PF: 4 ✅

**Результаты других тестов:**
- advisor-mode.integration.ts: 3/3 ✅
- demo-adhoc.yaml: 9/9 ✅

---

## Осталось сделать (после Phase 6.12)

### Критично для демо

- [ ] **Batch тесты с ТЕМИ ЖЕ контекстами** — demo-cold-start.yaml должен создавать контекст идентичный ALEX_REFERENCE_CONTEXT из integration test
- [ ] `npm run lint:fix && npx tsc --noEmit` — финальная проверка
- [ ] Прогнать demo-cold-start.yaml batch test

### Phase 7: grammY e2e tests

- [ ] `tests/telegram-bot/e2e/demo-video-1.e2e.ts` (adhoc)
- [ ] `tests/telegram-bot/e2e/demo-video-2.e2e.ts` (PDF upload через `Profile.pdf`)

### Финал

- [ ] Записать Video 1 (adhoc, ≤3.5 мин)
- [ ] Записать Video 2 (cold-start + DTW + PDF, ≤5.5 мин)

### Phase 7: grammY e2e tests

- [ ] `tests/telegram-bot/e2e/demo-video-1.e2e.ts` (adhoc)
- [ ] `tests/telegram-bot/e2e/demo-video-2.e2e.ts` (PDF upload)

### Финал

- [ ] Записать Video 1 (adhoc, ≤3.5 мин)
- [ ] Записать Video 2 (cold-start + DTW + PDF, ≤5.5 мин)

### Tech Debt

- [ ] FEAT-057: Goal как graph properties
- [ ] FEAT-058: Удалить абстракцию Phases (→ interrupt payload = response)

---

## Ключевые изменения в коде (Phase 6.6)

| Файл | Изменение |
|------|-----------|
| `src/cypher/queries/search.ts` | 4 места: добавлены `matchedCitizenships`/`refCitizenships` в WITH statements |
| `tests/core/fixtures/Demo-*.json` | citizenships RU в reference context |

---

## Команды для проверки

```bash
# Reimport fixtures
set -a && source .env.test && set +a && npx tsx scripts/import-demo-fixtures.ts

# Batch test
OPENROUTER_API_KEY=sk-or-v1-... timeout 600 npx tsx poc/mcp-chat.ts --session demo-verify --reset --batch tests/e2e/batches/demo-cold-start.yaml

# Проверить pathfinders через Neo4j (быстрее чем batch test)
MATCH (u:User)-[:HAS_CONTEXT]->(target:Context)
WHERE u.userId STARTS WITH 'usr_019b0055'
  AND target.position = 'head of engineering'
MATCH (u)-[:HAS_CONTEXT]->(ref:Context)
WHERE ref.createdAt < target.createdAt
  AND ref.position = 'technical project manager'
OPTIONAL MATCH (ref)-[:CITIZEN_OF]->(cit:Country)
WITH u, collect(DISTINCT cit.name) AS citizenships
WHERE 'RU' IN citizenships
RETURN u.userId, citizenships
```

---

## Рефлексия сессии

### Корневые причины ошибок

| Ошибка | Симптом | Первопричина | Урок |
|--------|---------|--------------|------|
| **role mismatch** | 0 pathfinders при batch test, хотя Neo4j query находит 4 | Не проверил что LLM goal extraction (role: "manager") совпадает с фикстурами (role: "architect") | **Сначала Neo4j query напрямую, потом debug logging** |
| **waymates без Goal** | waymates search не находит фикстуры | Обсуждали как ставить Goal, но не реализовали | **Проверять ВСЕ типы поиска, не только основной** |
| **this.logger в SearchManager** | TypeError: Cannot read properties of undefined | Добавил logging не проверив что класс имеет logger | **Проверять доступность зависимостей перед использованием** |

### Anti-patterns (добавить в guidelines.md)

1. **Debug через logging вместо Neo4j** — при проблемах с search сначала выполнить query напрямую в Neo4j MCP, проверить данные существуют и матчатся
2. **Частичная проверка фикстур** — проверять не только "данные есть", но и "данные матчатся по всем критериям для всех типов поиска"
3. **Assumptions о Goal** — waymates search требует Goal у кандидатов, не только contexts

### Anti-patterns (Phase 6.9)

4. **Test params ≠ fixture data** — тест использовал `domains: ["backend", "platform"]`, но fixture имела `["management", "backend"]`. Урок: перед написанием теста сверять params с actual fixture data
5. **Хардкод вместо констант** — использовал `["birthYear", "cityName", "companySize"]` вместо `DEFAULT_EXCLUDED_CONTEXT_FIELDS`. Урок: искать существующие константы через grep перед хардкодом
6. **Неправильный relationship type в проверке** — искал `:IN_DOMAIN` вместо `:IN_WORK_DOMAIN`. Урок: проверять relationship types в persistence.ts
7. **Не проверил ВСЕ strict fields** — educationLevel = strict, но не был в excludedContextFields → 2/4 waymates матчились. Урок: при 0 или partial results проверять ВСЕ strict fields

### Anti-patterns (Phase 6.10-6.11)

8. **Принял архитектуру как данность** — не спросил "зачем два парсера intent?" до того как пользователь спросил. Урок: перед рефакторингом спрашивать "зачем эта абстракция существует?"
9. **Не проверил полный data flow** — удалил `advising` phase не проверив как `answerText` попадает к пользователю. Урок: перед удалением/изменением проследить ВЕСЬ путь данных от источника до UI
10. **Предложил сложные решения первыми** — варианты A и B требовали больше изменений чем C, но C предложил последним. Урок: начинать с минимального решения, усложнять только если не работает
11. **Не задал вопрос о phases** — пользователь спросил "зачем phases?" — избыточная абстракция была очевидна после анализа. Урок: при рефакторинге спрашивать "эта абстракция всё ещё нужна?"

### Anti-patterns (Phase 6.12)

12. **Неверное понимание filterByCurrentContext** — понял как "ищет только по current контексту КАНДИДАТА". На самом деле: мы ВСЕГДА ищем по всем контекстам кандидата, `recency` ограничивает давность matched контекста. Урок: уточнять бизнес-логику перед изменением кода
13. **Test helpers с нечестными exclusions** — тесты исключали countryCode/languages, что не соответствует production. Урок: тесты должны использовать те же константы что production
14. **Alex goal в driver beforeAll** — устанавливался для всех тестов, но DEMO-EXPLORE должен работать БЕЗ goal. Урок: если тест требует конкретного state, тест сам должен его устанавливать и cleanup

### Phase 6.13: Cold-start extraction fix ✅

**Статус:** Частично завершено

**Диагностика проблемы:**
1. `npm run lint:fix && npx tsc --noEmit` ✅
2. demo-cold-start.yaml batch test → chartUrl = null (0 pathfinders)
3. Проверка Neo4j показала что cold-start user имеет:
   - position: "technical project manager" ✅
   - role: **NULL** ❌
   - domains: **[]** ❌
   - industry: "fintech" ✅

**Корневая причина:**
Cold-start промпт (`cold-start-v2/prompts.ts`) НЕ имел DECOMPOSITION APPROACH, который есть в adhoc (`search-graph/prompts/extraction.ts`).

LLM не знал как декомпозировать "Technical Project Manager":
- position = "technical project manager" (title) ✅
- role = "manager" (function) ❌ не извлечён
- domains = ["management", "backend"] ❌ не извлечены

**Что сделано:**
1. Очищены non-canonical словари в Neo4j:
   - Roles: удалены "project manager", "backend", "engineering"
   - Industries: удалены "research & development", "security systems", "tech"
   - Positions: удалён "software engineer"
2. Добавлены в `industries.json`: "research", "security"
3. Обновлён CV в `demo-cold-start.yaml`:
   - "Security Systems" → "Security"
   - "Research & Development" → "Research"
4. Добавлен DECOMPOSITION APPROACH в `cold-start-v2/prompts.ts` (строки 318-332)
5. Facade перезапущен с новым промптом

**Что сделано (Phase 6.13):**
- [x] **DECOMPOSITION_RULES → shared** — вынесено в `src/facade/langGraph/shared/prompts.ts`
- [x] **Улучшена семантика** — без конкретных примеров, только семантические правила
- [x] **demo-adhoc.yaml** — 9/9 ✅
- [x] **demo-cold-start.yaml** — 21/21 ✅ (один прогон)

### Phase 6.14: Pathfinder search debugging ✅

**Статус:** ЗАВЕРШЕНО

**Проблемы найдены и исправлены:**

1. **Roles verified=false** — после `import-demo-fixtures.ts` roles пересоздаются с `verified=false` через `persistence.ts`. Normalizer не может найти "manager" в словаре → role отфильтровывается.
   - **Fix:** Запускать `db:test:init` ПОСЛЕ `import-demo-fixtures.ts`

2. **userContext → adhocContextBase conversion** — pathfinder search в profile mode передавал `userContext` (с extra полями contextId, dates) вместо `adhocContextBase` в Core.
   - **Fix:** `adhocContextBase.parse(userContext)` в `search-pathfinders.ts:29`

3. **Мусорные users в БД** — batch tests создают users которые остаются и попадают в результаты.
   - **Fix:** Чистить users перед batch test: `MATCH (u:User) WHERE NOT u.userId STARTS WITH 'usr_019b0055' DETACH DELETE u`

### Phase 6.15: Overlap + Advisor + Chart Layout ✅

**Статус:** ЗАВЕРШЕНО

| # | Проблема | Причина | Fix | Файл |
|---|----------|---------|-----|------|
| 1 | Overlap только справа | LLM extraction давал неправильные domains/industry | Коррекции в batch test диалоге | `tests/e2e/batches/demo-cold-start.yaml` |
| 2 | Advisor галлюцинации "Google" | Пример "Senior at Google" в промпте | RESPONSE RULES без конкретных примеров | `src/facade/langGraph/search-graph/prompts/advisor.ts` |
| 3 | Spider сверху вместо рядом с таблицей | Layout #charts-row | Новый #metrics-row (flex) | `src/chart/builders/html-renderer.ts` |
| 4 | Total без контекста (2.70) | Формат toFixed(2) | 68% (2.03/3.00) — процент + raw | `src/chart/builders/html-renderer.ts:195-196` |
| 5 | Domain labels обрезались | margin.l: 150 | margin.l: 180 | `src/chart/builders/html-renderer.ts:533` |

**Результаты:**
- demo-cold-start.yaml: **21/21 ✅** (219s)
- Overlap #1: **2800d** распределён по timeline (2016-2026)
- Advisor: без галлюцинаций
- Chart: Spider рядом с таблицей, Total = 68% (2.03/3.00)

---

## Осталось сделать

### Готово к commit ✅

Все тесты проходят:
- [x] demo-adhoc.yaml: 9/9 ✅
- [x] demo-cold-start.yaml: 21/21 ✅
- [x] Advisor без галлюцинаций ✅
- [x] Chart layout правильный ✅
- [x] Overlap распределён по timeline ✅

### Phase 7: grammY e2e tests

- [ ] `tests/telegram-bot/e2e/demo-video-1.e2e.ts` (adhoc)
- [ ] `tests/telegram-bot/e2e/demo-video-2.e2e.ts` (PDF upload через `Profile.pdf`)

### Финал

- [ ] Записать Video 1 (adhoc, ≤3.5 мин)
- [ ] Записать Video 2 (cold-start + DTW + PDF, ≤5.5 мин)

### Tech Debt

- [ ] FEAT-057: Goal как graph properties
- [ ] FEAT-058: Удалить абстракцию Phases (→ interrupt payload = response)

---

## Рефлексия сессии (Phase 6.13-6.15)

### Anti-patterns (Phase 6.13)

15. **Не сравнил промпты перед дебагом** — потратил время на логи facade/core вместо простого diff adhoc vs cold-start промптов. Урок: при расхождении поведения двух flow → сначала сравнить промпты
16. **Добавил неинформативный пример** — `"Software Engineer" → position: "middle" or "senior"` без контекста. Урок: примеры должны быть конкретными с полным контекстом
17. **Не подумал о переиспользовании** — добавил DECOMPOSITION в cold-start копипастом вместо shared constant. Урок: при дублировании → сразу выносить в общий модуль
18. **Normalizer добавляет мусор** — `normalizeTerm()` добавляет non-canonical terms. Урок: проверять что normalizer не загрязняет словари
19. **Продолжал batch test после первого расхождения**. Урок: первое расхождение = стоп, анализ
20. **Не спросил о возможности унификации**. Урок: при обнаружении дублирования → сразу спросить

### Anti-patterns (Phase 6.14)

21. **Не проверил Redis cache сразу**. Урок: при normalizer проблемах → сначала проверить Redis cache и dictionary verified status
22. **Долгий feedback loop** — 2+ мин batch test вместо quick test script. Урок: создать minimal reproduction script СРАЗУ
23. **Инкрементальный debug logging**. Урок: добавить logging на ВСЕХ уровнях за один раз
24. **Не понял разницу типов** — userContext ≠ adhocContextBase. Урок: проверять что типы совместимы
25. **Не логировал generated query**. Урок: при Cypher debugging → логировать И query И params

### Anti-patterns (Phase 6.15)

26. **Смотрел СТАРЫЕ chart URLs** — пользователь дал старые URLs, а фиксы были в новых. Урок: при визуальной проверке фиксов → сначала уточнить какие артефакты актуальны
27. **Начал анализ fixtures вместо чтения отчётов** — пользователь дал готовые отчёты с root cause, но я начал свой анализ. Урок: если есть готовый контекст — сначала прочитать его ПОЛНОСТЬЮ
28. **LLM копирует примеры буквально** — примеры "Google" в промпте → LLM подставлял "Google". Урок: примеры в промптах должны быть абстрактными (Candidate #N) или вообще отсутствовать

---

## Команды для проверки

```bash
# Cleanup garbage users
MATCH (u:User) WHERE NOT u.userId STARTS WITH 'usr_019b0055' DETACH DELETE u

# Batch tests
set -a && source .env.test && set +a
OPENROUTER_API_KEY=sk-or-v1-... npx tsx poc/mcp-chat.ts --session demo-adhoc --reset --batch tests/e2e/batches/demo-adhoc.yaml
OPENROUTER_API_KEY=sk-or-v1-... npx tsx poc/mcp-chat.ts --session demo-cs --reset --batch tests/e2e/batches/demo-cold-start.yaml

# Quick chart test
npx tsx poc/test-chart-overlap.ts
```

---

### Phase 7: GramJS Telegram e2e tests ✅

**Статус:** ЗАВЕРШЕНО

**Что сделано:**
1. **Commit** `19fa27f` — Phase 6.15 изменения закоммичены ✅
2. **GramJS скрипты созданы:**
   - `poc/demo-video-1-telegram.ts` — adhoc flow (6 шагов)
   - `poc/demo-video-2-telegram.ts` — cold-start + PDF (16 шагов)

### Phase 7.1: Event Handler вместо Polling ✅

**Проблема:** `getLastBotMessage()` использовал GetHistory polling — получал СТАРЫЕ сообщения бота от предыдущих диалогов.

**Research (Context7 + WebSearch):**
- [GramJS Updates Events](https://painor.gitbook.io/gramjs/getting-started/updates-events)
- [NewMessage class](https://gram.js.org/beta/classes/custom.NewMessage.html)

**Best Practice:** Event Handler вместо Polling:
```typescript
import { NewMessage } from "telegram/events";

function waitForBotReply(client: TelegramClient, botUsername: string, timeout: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      client.removeEventHandler(handler, event);
      reject(new Error(`Timeout`));
    }, timeout);

    const event = new NewMessage({ chats: [botUsername] });
    const handler = (e: NewMessageEvent): void => {
      if (e.message.out) return;
      clearTimeout(timer);
      client.removeEventHandler(handler, event);
      resolve(e.message.text ?? "");
    };
    client.addEventHandler(handler, event);
  });
}
```

**Паттерн использования:**
```typescript
const replyPromise = waitForBotReply(client, BOT, WAIT_MS);  // 1. Подписка
await sendMessage(client, step.message);                      // 2. Отправка
const response = await replyPromise;                          // 3. Ждём event
```

### Phase 7.2: Markdown конвертер ✅

**Проблема:** Бот падал с `GrammyError: can't parse entities` — LLM генерировал невалидный Markdown (незакрытые `**`).

**Research (Context7 + WebSearch):**
- [telegramify-markdown](https://github.com/skoropadas/telegramify-markdown) — npm пакет
- ⭐ 87 stars, 📦 2064 downloads/week, обновлён 17 Dec 2025

**Корневая причина:**
| LLM генерирует | Telegram ожидает |
|----------------|------------------|
| Стандартный Markdown (GitHub/CommonMark) | Telegram MarkdownV2 (другой синтаксис + escaping) |

**Решение (индустриальный стандарт):**
```bash
npm install telegramify-markdown
```

```typescript
// format-response.ts
import telegramifyMarkdown from "telegramify-markdown";

return telegramifyMarkdown(formatted, "escape");
```

**Изменённые файлы:**
| Файл | Изменение |
|------|-----------|
| `package.json` | +telegramify-markdown |
| `src/telegram-bot/presenters/format-response.ts` | +telegramifyMarkdown() |
| `src/telegram-bot/handlers/converse.ts` | parse_mode: "MarkdownV2" |
| `src/telegram-bot/handlers/document.ts` | parse_mode: "MarkdownV2" |
| `src/telegram-bot/handlers/voice.ts` | parse_mode: "MarkdownV2" |
| `poc/demo-video-1-telegram.ts` | WAIT_MS: 45000, waitForBotReply() |
| `poc/demo-video-2-telegram.ts` | waitForBotReply() |

**Результат:** demo-video-1-telegram.ts — 6/6 ✅

---

## Осталось сделать

### Phase 7: GramJS Telegram e2e tests ✅ DONE

- [x] Fix `getLastBotMessage()` → заменён на `waitForBotReply()` с Event Handler
- [x] Протестировать demo-video-1-telegram.ts — 6/6 ✅
- [ ] Протестировать demo-video-2-telegram.ts (PDF upload)

### Финал

- [ ] Записать Video 1 (adhoc, ≤3.5 мин)
- [ ] Записать Video 2 (cold-start + DTW + PDF, ≤5.5 мин)

### Tech Debt

- [ ] FEAT-057: Goal как graph properties
- [ ] FEAT-058: Удалить абстракцию Phases (→ interrupt payload = response)

---

## Рефлексия сессии (Phase 7)

### Anti-patterns (Phase 7.0 — предыдущая сессия)

29. **Не понял требование** — пользователь сказал "телеграм e2e тесты", я создал MCP integration тесты. Пользователь указал пример `poc/e2e-variant2-llm-user-prod.ts` — я должен был СРАЗУ прочитать его. Урок: **при указании примера — сначала читай пример, потом делай**

30. **Создал код без понимания контекста** — сделал MCP тесты потому что уже знал инфраструктуру telegram-bot/integration. Не спросил "как именно тесты должны работать?". Урок: **если требование неоднозначно — уточнять ДО начала реализации**

31. **getLastBotMessage без фильтрации по времени** — классическая ошибка при работе с chat history. Telegram GetHistory возвращает все сообщения, нужно фильтровать по дате. Урок: **при получении истории чата — всегда фильтровать по времени отправки**

### Anti-patterns (Phase 7.1-7.2 — текущая сессия)

32. **Написал "предположительно" про код который уже читал** — пользователь указал что файлы были прочитаны в начале сессии, а я писал "предположительно". Урок: **не писать "предположительно" если файл уже прочитан — использовать конкретику**

33. **Предложил костыльный sanitize вместо best practice** — первое решение было ручной sanitize Markdown (подсчёт `**`). Пользователь спросил "это best practice?". Урок: **СНАЧАЛА искать индустриальные решения (Context7 + WebSearch), ПОТОМ предлагать**

34. **Не проверил популярность решения** — рекомендовал библиотеку без проверки stars/downloads. Пользователь попросил статистику. Урок: **при рекомендации библиотеки — СРАЗУ давать статистику (stars, downloads, last update)**

35. **Объяснял без конкретики** — первые объяснения были абстрактными. Пользователь переспрашивал "что значит?". Урок: **объяснять на КОНКРЕТНЫХ примерах с визуализацией (таблицы, временные шкалы)**

36. **Polling вместо Event Handler** — изначально предложил fix через afterDate (всё ещё polling). Best practice — Event Handler (`NewMessage`). Урок: **при работе с real-time данными — Event Handler > Polling**

---

### Phase 7.3: UX Analysis + FEAT-059 Plan ✅

**Статус:** ЗАВЕРШЕНО

**Что сделано:**
1. Прогнан demo-video-2-telegram.ts — получен фидбек (9 проблем)
2. Глубокий анализ каждой проблемы через sequential-thinking
3. Найден главный root cause + создан план исправлений

**Критический Root Cause найден:**

```
/start НЕ очищает checkpoint
→ pending interrupt от предыдущей сессии
→ первое сообщение resume-ит его
→ "Hey, I'm just browsing" классифицируется как explore
→ бот сразу показывает candidates (вместо confirm)
```

**Доказательство из логов facade:**
```
1767537581071 - Tool execution completed (phase=confirming_adhoc_context)
1767537581083 - Tool execution started  (НОВЫЙ CALL!) — 12ms!
```

**9 проблем → 5 phases fix:**

| Phase | Fix | LOC |
|-------|-----|-----|
| 1. Critical Flow | Очистка checkpoint при /start, prompt консистентный с routing | ~50 |
| 2. Locale | i18n в document.ts | ~20 |
| 3. Advisor Data | rename searchResults→waymateResults, fix generate-answer | ~40 |
| 4. Dictionary | questionType в ask schema | ~40 |
| 5. Vision | Chart screenshotter + multimodal LLM | ~90 |

**Routing анализ:**

```typescript
// БЕЗ ЦЕЛИ (CONFIRMING_NO_GOAL_ROUTES):
- explore, setGoal, editAdhoc, ask, cancel, unknown

// С ЦЕЛЬЮ (CONFIRMING_WITH_GOAL_ROUTES):
- searchWaymates, searchPathfinders, validate, editGoal, editAdhoc, ask, cancel, unknown
```

**Несоответствие найдено:**
- Prompt говорит "Offer: set goal or explore similar people"
- НЕ упоминает editAdhoc, ask
- НЕ различает случаи с целью и без

**Артефакты созданы:**
- `tasks/features/FEAT-059-demo-video-ux-fixes.md` — полный план работ

**Commit:**
```
9bd1e26 feat(FEAT-055): GramJS demo scripts, telegramify-markdown, UX fixes plan
```

---

## Осталось сделать

### FEAT-059: Demo Video UX Fixes (READY_FOR_WORK)

**Phase 1: Critical Flow (~50 LOC)**
- [ ] Очистка checkpoint при /start
- [ ] Prompt консистентный с routing
- [ ] Убрать хардкод русского в confirm-adhoc-context.ts

**Phase 2: Locale (~20 LOC)**
- [ ] i18n в document.ts

**Phase 3: Advisor Data (~40 LOC)**
- [ ] rename searchResults → waymateResults
- [ ] Fix generate-answer для pathfinders/exploration
- [ ] Skills limit constant

**Phase 4: Dictionary Questions (~40 LOC)**
- [ ] questionType в ask schema

**Phase 5: Vision для Charts (~90 LOC)**
- [ ] Chart screenshotter service
- [ ] Multimodal LLM call

### Финал

- [ ] Записать Video 1 (adhoc, ≤3.5 мин)
- [ ] Записать Video 2 (cold-start + DTW + PDF, ≤5.5 мин)

### Tech Debt

- [ ] FEAT-057: Goal как graph properties
- [ ] FEAT-058: Удалить абстракцию Phases (→ interrupt payload = response)

---

## Рефлексия сессии (Phase 7.3)

### Anti-patterns (Phase 7.3)

37. **Долгий анализ логов вместо простой гипотезы** — 30+ минут анализировал timestamps в логах, хотя root cause (checkpoint не очищается при /start) можно было найти за 5 минут проверкой handlers/start.ts. Урок: **при unexpected behavior после /start — сначала проверить что /start делает с state**

38. **Предложил regex-парсинг для словарей** — пользователь напомнил "ручной парсинг строк строго запрещен". Урок: **перед предложением решения — проверить guidelines.md на запреты**

39. **Не понял вопрос "что пошло не так в тесте"** — продолжал объяснять timestamps вместо простого ответа "checkpoint от предыдущей сессии resume-ился". Урок: **если пользователь переспрашивает — значит объяснение непонятное, переформулировать проще**

40. **Не нашёл routing сразу** — пользователь попросил "найти routing где в зависимости от наличия цели свои интенты". Это было в search-router.ts строки 101-118, но я искал в других местах. Урок: **routing logic → search-router.ts (source of truth)**

41. **Предложил "убрать explore из prompt" без проверки routing** — правильный fix: сделать prompt КОНСИСТЕНТНЫМ с routing, а не менять routing под prompt. Урок: **routing = source of truth, prompt должен отражать routing**

---

## Полезные ссылки

### Документация
- `tasks/features/FEAT-059-demo-video-ux-fixes.md` — полный план UX fixes

### Routing (source of truth)
- `src/facade/langGraph/search-graph/search-router.ts:101-118` — CONFIRMING_WITH_GOAL_ROUTES / CONFIRMING_NO_GOAL_ROUTES
- `src/facade/langGraph/search-graph/search-router.ts:64-68` — getValidIntentsForPhase()

### Prompts
- `src/facade/services/nlp-formatter/prompts.ts:15-19` — confirming_adhoc_context description

### Vision example
- `src/facade/mcp-server/tools/parse-cv-to-text.tool.ts:90-113` — multimodal LLM call

---

### Phase 7.4: FEAT-059 Implementation — cancel_all_graphs ✅

**Статус:** Phase 1.1 ЗАВЕРШЕНО, проверено

**Что сделано:**

1. **Новый MCP tool `cancel_all_graphs`:**
   - `src/shared/schemas.ts` — добавлены `mcpCancelAllGraphsParamsSchema` + `cancelAllGraphsResponseSchema`
   - `src/facade/services/orchestrator/graph-manager.service.ts:41-46` — метод `cancelAllActiveGraphs(userId)`
   - `src/facade/mcp-server/tools/cancel-all-graphs.tool.ts` — новый tool (20 LOC)
   - `src/facade/mcp-server/mcp-server.ts` — регистрация tool (версия 3.3.0)

2. **Telegram bot integration:**
   - `src/telegram-bot/services/tool-registry.ts` — добавлен `cancel_all_graphs`
   - `src/telegram-bot/handlers/start.ts` — вызов `cancel_all_graphs` перед welcome

**Верификация:**
```bash
# Создал сессию с cold_start flow (awaiting_plan_confirmation)
npx tsx poc/mcp-chat.ts --session test-cancel "I'm a backend developer in Russia"

# Вызвал cancel_all_graphs напрямую → {"success": true}

# Следующее сообщение начало НОВЫЙ flow (asking_adhoc_context)
# вместо resume старого cold_start
```

**Результат:** /start теперь очищает все checkpoints → предсказуемый flow ✅

---

## Осталось сделать

### FEAT-059: Demo Video UX Fixes

**Phase 1: Critical Flow (~50 LOC)** — частично
- [x] Очистка checkpoint при /start ✅
- [ ] **Prompt консистентный с routing** ← СЛЕДУЮЩИЙ ШАГ
- [ ] Убрать хардкод русского в confirm-adhoc-context.ts

**Phase 2: Locale (~20 LOC)**
- [ ] i18n в document.ts

**Phase 3: Advisor Data (~40 LOC)**
- [ ] Fix generate-answer для pathfinders
- [ ] Skills limit constant

**Phase 4: Cleanup (~10 LOC)**
- [ ] Убрать buildConfirmMessage из confirm-adhoc-context.ts

**Phase 5-6: Отложено (не блокирует demo)**

### Финал

- [ ] Lint + tsc + batch tests
- [ ] Записать Video 1 (adhoc, ≤3.5 мин)
- [ ] Записать Video 2 (cold-start + DTW + PDF, ≤5.5 мин)

---

## Рефлексия сессии (Phase 7.4)

### Anti-patterns

42. **Не протестировал новый код до перехода к следующей задаче** — создал cancel_all_graphs tool, обновил todo на Phase 1.2 БЕЗ проверки что tool работает. Пользователь спросил "poc не нужно сделать проверить новый код?". Урок: **после создания нового tool/feature — ОБЯЗАТЕЛЬНО poc тест перед переходом дальше**

43. **Предложил два подхода (MCP tool vs converse param) но не дал чёткую рекомендацию сразу** — пользователь попросил "нужны твои рекомендации, сравнение, аргументы". Урок: **при предложении вариантов — СРАЗУ давать рекомендацию с обоснованием (таблица сравнения + аргументы + итог)**

---

### Phase 7.5: UX Prompts Refactoring ✅

**Статус:** ЗАВЕРШЕНО, требуется отладка

**Что сделано:**

1. **Phase 1.2-1.3: prompts.ts + confirm-adhoc-context.ts**
   - Conditional description для `confirming_adhoc_context` (hasGoal=true/false)
   - Удалён buildConfirmMessage (~40 LOC dead code)

2. **Structured format для result phases:**
   - `CONTEXT_BLOCK`, `GOAL_BLOCK`, `FILTERS_BLOCK` — reusable format blocks
   - Все result phases (exploration, waymates, pathfinders, validate) используют структурный формат

3. **DRY field descriptions:**
   - `HINTS` object в `shared/prompts.ts` — общие hints (map to KNOWN...)
   - `ADHOC_FIELD_DESCRIPTIONS` — перенесено из extraction.ts
   - `GOAL_FIELD_DESCRIPTIONS` — перенесено из extraction.ts
   - Единый source of truth для extraction и NLP formatter

4. **education_level:**
   - Добавлен в `HINTS` ("map to KNOWN EDUCATION LEVELS")
   - Добавлен в `buildHints()` вызовы (7 файлов):
     - search-graph: load-context, extract-goal
     - cold-start-v2: extract-context
     - upsert-context: extract-context, edit-context
     - update-context: extract-updates, edit-update
   - Добавлен в cold-start prompt (OPTIONAL FIELDS секция)

5. **asking_search_mode fix:**
   - Убрано повторение цели ("DO NOT repeat goal details")
   - Краткий формат: "Goal saved. Choose: Pathfinders or Waymates"

**Изменённые файлы:**

| Файл | Изменение |
|------|-----------|
| `src/facade/langGraph/shared/prompts.ts` | +HINTS, +ADHOC_FIELD_DESCRIPTIONS, +GOAL_FIELD_DESCRIPTIONS |
| `src/facade/langGraph/search-graph/prompts/extraction.ts` | -локальные описания, +import из shared |
| `src/facade/services/nlp-formatter/prompts.ts` | +structured blocks, +CANDIDATE_FIELDS/GOAL_FIELDS |
| `src/facade/langGraph/search-graph/nodes/confirm-adhoc-context.ts` | -buildConfirmMessage dead code |
| `src/facade/langGraph/cold-start-v2/prompts.ts` | +educationLevel в OPTIONAL FIELDS |
| 7 файлов с buildHints | +education_level |

**GramJS тест:** 6/6 ✅

**Новая проблема найдена (для следующей сессии):**
```
Step 6: "What skills did they all need for this transition?"
Expected: advisor answer (showing_pathfinder_results с answerText)
Actual: searchPathfinders вызвался повторно → новый showing_pathfinder_results БЕЗ answerText
```

**Вероятная причина:** `done` intent не срабатывает, или routing некорректный после show_answer.

---

## Осталось сделать

### FEAT-059: Demo Video UX Fixes

**Phase 1: Critical Flow** — ✅ ЗАВЕРШЕНО
- [x] Очистка checkpoint при /start ✅
- [x] Prompt консистентный с routing ✅
- [x] Structured format для result phases ✅
- [x] DRY field descriptions ✅

**Требует отладки:**
- [ ] **Step 6 advisor bug** — "What skills..." вызывает searchPathfinders вместо advisor answer

**Phase 2-5: Отложено** (ждут отладки Phase 1)

### Финал

- [ ] Lint + tsc + batch tests
- [ ] Записать Video 1 (adhoc, ≤3.5 мин)
- [ ] Записать Video 2 (cold-start + DTW + PDF, ≤5.5 мин)

---

## Рефлексия сессии (Phase 7.5)

### Anti-patterns

44. **"@ company" в промпте без проверки данных** — написал "role @ company" хотя в WayMates компании анонимизированы. Урок: **перед написанием формата — проверить какие данные реально доступны в схеме**

45. **Копипаста field descriptions вместо DRY** — изначально предложил скопировать ADHOC_FIELD_DESCRIPTIONS в shared/prompts.ts. Пользователь указал "дублируются же!". Урок: **при переносе констант — сразу удалять из источника и импортировать**

46. **Не связал описания с Zod schema** — пользователь спросил "нет single truth". Правильно: описания должны быть связаны с типами через Record<keyof Type, string>. Урок: **описания полей = Record<keyof SchemaType, string> для type safety**

47. **Общие hints не вынесены в константы** — "map to KNOWN POSITIONS" повторялось в adhoc и goal descriptions. Пользователь указал на DRY. Урок: **повторяющиеся фрагменты в описаниях → выносить в HINTS object**

48. **Добавил "map to KNOWN EDUCATION LEVELS" без проверки buildHints** — пользователь спросил "словари предоставляют education levels?". Оказалось education_level НЕ был в buildHints вызовах. Урок: **hint "map to KNOWN X" валиден ТОЛЬКО если X есть в buildHints()**

49. **Не проверил ВСЕ места с buildHints** — пропустил cold-start и другие flows. Урок: **grep buildHints перед изменением — обновить ВСЕ места**

50. **Не добавил education в cold-start prompt** — после добавления в buildHints, пользователь спросил "в coldstart промпт тоже нужно?". Урок: **если поле добавляется в hints — добавить его описание в СООТВЕТСТВУЮЩУЮ секцию промпта**

---

## Полезные ссылки

### DRY Architecture
- `src/facade/langGraph/shared/prompts.ts` — HINTS, FIELD_DESCRIPTIONS (source of truth)
- `src/facade/langGraph/search-graph/prompts/extraction.ts` — импортирует из shared
- `src/facade/services/nlp-formatter/prompts.ts` — импортирует из shared

### Structured format blocks
- `CONTEXT_BLOCK` — "👤 Your context: ✅ SPECIFIED / ⚪ NOT SET"
- `GOAL_BLOCK` — "🎯 Goal: ✅ SPECIFIED / ⚪ NOT SET"
- `FILTERS_BLOCK` — "🔍 Filters: recency / excluded / rejectedFields"

### buildHints locations (7 files)
- `search-graph/nodes/load-context.ts:129`
- `search-graph/nodes/extract-goal.ts:29`
- `cold-start-v2/nodes/extract-context.ts:100`
- `upsert-context/nodes/extract-context.ts:23`
- `upsert-context/nodes/edit-context.ts:23`
- `update-context/nodes/extract-updates.ts:23`
- `update-context/nodes/edit-update.ts:23`

---

### Phase 7.6: Advisor Bug Fix + Docker Bot ✅

**Статус:** ЗАВЕРШЕНО

**Что сделано:**

1. **Step 6 advisor bug — 3 fix'а:**

   | Проблема | Root Cause | Fix |
   |----------|------------|-----|
   | ask intent не распознавался | classification prompt не указывал что results УЖЕ показаны | +PHASE_CONTEXT в `classification.ts` |
   | answerText не передавался в NLP | JSON.stringify убирает undefined поля | `answerText: state.currentAnswer ?? null` |
   | NLP показывал results вместо answer | prompt требовал "answer + results summary" | "Show ONLY the answer" |

2. **"@ company" → ${CANDIDATE_FIELDS}:**
   - prompts.ts:139 — заменено на DRY константу

3. **Telegram bot в Docker:**
   - Dockerfile: +target `telegram-bot-test`
   - docker-compose.yml: +service `telegram-bot-test` (profile: test)
   - package.json: +npm scripts `bot:docker:up/down/restart/clean/logs`

**Изменённые файлы:**

| Файл | Изменение |
|------|-----------|
| `src/facade/langGraph/search-graph/prompts/classification.ts` | +PHASE_CONTEXT map |
| `src/facade/langGraph/search-graph/response-builders.ts` | `?? null` для answerText |
| `src/facade/services/nlp-formatter/prompts.ts` | "Show ONLY the answer" + ${CANDIDATE_FIELDS} |
| `Dockerfile` | +telegram-bot-test target |
| `docker-compose.yml` | +telegram-bot-test service |
| `package.json` | +bot:docker:* scripts |

**Результат:** GramJS тест 6/6 ✅, Step 6 показывает advisor answer

---

## Осталось сделать

### FEAT-059: Demo Video UX Fixes — ✅ ЗАВЕРШЕНО

- [x] Очистка checkpoint при /start ✅
- [x] Prompt консистентный с routing ✅
- [x] Structured format для result phases ✅
- [x] DRY field descriptions ✅
- [x] Step 6 advisor bug ✅
- [x] "@ company" → CANDIDATE_FIELDS ✅
- [x] Docker bot ✅

### FEAT-060: Salary в Goal (СЛЕДУЮЩАЯ СЕССИЯ)

**Текущее состояние:**
- AdhocContext: ✅ salaryExact, salaryMin, salaryMax
- TargetContext (goal): ❌ нет salary
- Cypher query-builders: ❌ нет фильтрации по salary

**Что нужно:**
1. **Schema**: добавить в `TargetContext` (schemas.ts:457-471):
   ```typescript
   salaryMin: fieldFilterSchema.nullable()
   salaryMax: fieldFilterSchema.nullable()
   ```

2. **Extraction prompt**: научить LLM извлекать target salary (extraction.ts)

3. **Cypher query-builders**: WHERE clause для salary range:
   ```cypher
   WHERE target.salaryExact >= $salaryMin
     AND target.salaryExact <= $salaryMax
   ```

4. **NLP prompts**: показывать salary в goal summary

**Оценка:** ~30-50 LOC

### Финал

- [ ] Записать Video 1 (adhoc, ≤3.5 мин)
- [ ] Записать Video 2 (cold-start + DTW + PDF, ≤5.5 мин)

### Tech Debt

- [ ] FEAT-057: Goal как graph properties
- [ ] FEAT-058: Удалить абстракцию Phases (→ interrupt payload = response)

---

## Рефлексия сессии (Phase 7.6)

### Anti-patterns

51. **undefined vs null в JSON.stringify** — не учёл что `JSON.stringify({a: undefined})` → `{}` (поле пропадает). Fix: `value ?? null`. Урок: **при передаче данных через JSON — явно конвертировать undefined в null**

52. **"Show answer FIRST, then results"** — LLM буквально показывал и answer и results. Нужно было "Show ONLY the answer". Урок: **в промптах с условиями — явно указывать что НЕ делать**

53. **Не проверил весь data flow до NLP formatter** — проблема была в response-builder (undefined → пропадает из JSON), но сначала искал в classification. Урок: **debug от конца (NLP input) к началу, не наоборот**

---

## Полезные ссылки

### Phase Context (classification)
- `src/facade/langGraph/search-graph/prompts/classification.ts:10-14` — PHASE_CONTEXT map

### Response builders (answerText)
- `src/facade/langGraph/search-graph/response-builders.ts:122,132` — `?? null`

### Docker bot
- `Dockerfile:19-22` — telegram-bot-test target
- `docker-compose.yml:216-236` — telegram-bot-test service
- `package.json:12-16` — bot:docker:* scripts

---

### Phase 7.7: FEAT-060 Salary в Goal ✅

**Статус:** ЗАВЕРШЕНО (остались minor fixes для Phase 7.8)

**Что сделано:**

1. **Schema updates:**
   - `TargetContext` — добавлены `salaryMin`, `salaryMax` (z.number().nullable())
   - `AdhocContextBase` — добавлены `salaryMin`, `salaryMax` (z.number().nullable())
   - `CategoricalTargetField` type — исключает salary из categorical filters

2. **Field descriptions (DRY):**
   - `GOAL_FIELD_DESCRIPTIONS` — `salaryMin`, `salaryMax` с примерами (e.g. 150000, 250000)
   - `ADHOC_FIELD_DESCRIPTIONS` — `salaryMin`, `salaryMax` (current salary)

3. **Cypher query-builders:**
   - `buildPathfinderSearchQuery` — salary filter: `WHERE salary >= $salaryMin`
   - `buildReversePathfinderSearchQuery` — salary filter
   - Logic: "Goal minimum only" (candidate.salary >= goal.salaryMin)

4. **NLP prompts refactoring:**
   - **Explicit array names** — галлюцинации LLM фиксятся через явное указание массивов
   - `explorationResults` для showing_exploration_candidates
   - `waymatesResults` для showing_waymate_results (переименовано из searchResults!)
   - `pathfinderResults` для showing_pathfinder_results

5. **Demo fixtures:**
   - Все pathfinders обновлены: salary >= 200k (было 175-195k)
   - Файлы: IdealPathfinder, DirectPathfinder, AltRoutePathfinder, SprintPathfinder, DSToFounder, PMToFounder

6. **Rename для консистентности:**
   - `searchResults` → `waymatesResults` в 5 файлах state/nodes

**Изменённые файлы:**

| Файл | Изменение |
|------|-----------|
| `src/shared/schemas.ts` | +salaryMin/Max в TargetContext и AdhocContextBase |
| `src/facade/langGraph/shared/prompts.ts` | +salary в GOAL_FIELD_DESCRIPTIONS и ADHOC_FIELD_DESCRIPTIONS |
| `src/cypher/queries/search.ts` | +salary CASE filter в 2 queries |
| `src/cypher/helpers/filters.ts` | +CategoricalTargetField type, Partial<Record> |
| `src/facade/services/normalizer.ts` | +salaryMin/Max passthrough |
| `src/facade/services/nlp-formatter/prompts.ts` | Explicit array names + currentAnswer check |
| `src/facade/langGraph/search-graph/state.ts` | searchResults → waymatesResults |
| `src/facade/langGraph/search-graph/nodes/*.ts` | searchResults → waymatesResults |
| `tests/core/fixtures/Demo-*.json` | salary >= 200k |
| `tests/core/integration/search-manager/demo-fixtures.integration.ts` | +salaryMin/Max в test context |

**Результат:** GramJS тест 6/6 ✅, salary extraction работает

---

## Осталось сделать

### Phase 7.8: Minor Salary Fixes (СЛЕДУЮЩАЯ СЕССИЯ)

**3 проблемы найдены:**

1. **ADHOC_OPTIONAL_FIELDS не содержит salary:**
   - `src/shared/schemas.ts:327-336` — добавить `salaryMin`, `salaryMax`
   - Иначе в "Optional fields" не показывается salary

2. **Единицы измерения не консистентны:**
   - Везде должно быть USD явно
   - Prompts: "annual salary in USD"
   - NLP: "💰 Salary: $200k+ USD"

3. **Ask intent не распарсился (Step 6):**
   - "What skills..." классифицировался как searchPathfinders вместо ask
   - Нужно проверить classification prompt

**Оценка:** ~20 LOC

### Финал

- [ ] Phase 7.8 minor fixes
- [ ] Записать Video 1 (adhoc, ≤3.5 мин)
- [ ] Записать Video 2 (cold-start + DTW + PDF, ≤5.5 мин)

### Tech Debt

- [ ] FEAT-057: Goal как graph properties
- [ ] FEAT-058: Удалить абстракцию Phases

---

## Рефлексия сессии (Phase 7.7)

### Anti-patterns

54. **Числовые поля в categorical config** — изначально добавил salary в TARGET_FILTER_CONFIG (для mode: desired/undesired). Salary — числовое поле, нужно отдельную логику. Урок: **различать categorical (mode + values[]) vs numeric (range) фильтры**

55. **Неконсистентные описания полей** — написал `salaryMax: "optional"` а `salaryMin` без optional. Пользователь указал. Урок: **описания полей должны быть консистентны по формату**

56. **Абстрактные имена массивов в prompts** — `📋 Results: [count]` вместо `📋 Results: [pathfinderResults.length]`. LLM галлюцинировал "need more info". Урок: **в prompts с данными — ЯВНО указывать имена полей откуда брать данные**

57. **Не переименовал searchResults сразу** — создал waymatesResults но оставил searchResults. Пользователь указал на неконсистентность. Урок: **при добавлении новых полей результатов — сразу проверить naming consistency**

58. **Не добавил salary в ADHOC_OPTIONAL_FIELDS** — добавил в schema но забыл про list optional fields. Урок: **при добавлении optional field — проверить ADHOC_OPTIONAL_FIELDS**

59. **sed вместо MCP filesystem** — попытался использовать sed для batch rename. Пользователь запретил. Урок: **batch edits — MCP filesystem, не sed**

---

### Phase 7.8: Minor Salary Fixes ✅

**Статус:** ЗАВЕРШЕНО

**Что сделано:**

1. **ADHOC_OPTIONAL_FIELDS + salary:**
   - `schemas.ts:327` — добавлены `salaryMin`, `salaryMax` в массив
   - `schemas.ts:295-296` — добавлены `.describe()` с USD

2. **USD везде (7 мест):**
   - `nlp-formatter/prompts.ts` — 5 мест "salary (USD)"
   - `html-renderer.ts` — chart labels "Salary (USD)" / "Зарплата (USD)"
   - `extract-single-context.tool.ts` — optional fields с "(USD)"

3. **Ask intent fix (Step 6):**
   - **Root cause:** `currentAnswer` в state, но `answerText` в response-builders → NLP не видел answer
   - **Fix:** Унификация — переименовано `currentAnswer` → `answerText` везде:
     - `state.ts:144` — `answerText` вместо `currentAnswer`
     - `generate-answer.ts:60` — `answerText`
     - `show-answer.ts:16` — `state.answerText`
     - `response-builders.ts:122,132` — `state.answerText`
   - **NLP prompts:** "Check answerText field first"

4. **Advisor генерирует ответ по правильным candidates:**
   - `generate-answer.ts:10-21` — `getCandidatesForPhase()` helper
   - Использует `pathfinderResults` для showing_pathfinder_results
   - Использует `explorationResults` для showing_exploration_candidates
   - Использует `waymatesResults` для остальных phases
   - **Type fix:** `CandidateBase` вместо `WaymateCandidate` в advisor-context-builder

5. **ADVISOR_SKILLS_LIMIT константа:**
   - `advisor-context-builder.ts:4` — `export const ADVISOR_SKILLS_LIMIT = 10`
   - Используется в `generate-answer.ts` и `advisor-context-builder.ts`

6. **NLP не требует optional fields:**
   - `prompts.ts` — "CRITICAL: NULL values in adhocContext are OPTIONAL"
   - Добавлено в 3 phases: exploration, waymates, pathfinders

7. **Infra fixes:**
   - `start.ts` — graceful handling если сессии нет (try-catch для cancel_all_graphs)
   - `package.json` — `facade:rebuild` теперь перезапускает бота автоматически

**Изменённые файлы:**

| Файл | Изменение |
|------|-----------|
| `src/shared/schemas.ts` | +salaryMin/Max в ADHOC_OPTIONAL_FIELDS + describe() |
| `src/facade/services/nlp-formatter/prompts.ts` | +USD, +answerText check, +CRITICAL NULL values |
| `src/chart/builders/html-renderer.ts` | Salary (USD) labels |
| `src/facade/langGraph/shared-tools/extract-single-context.tool.ts` | (USD) in optional |
| `src/facade/langGraph/search-graph/state.ts` | currentAnswer → answerText |
| `src/facade/langGraph/search-graph/nodes/generate-answer.ts` | +getCandidatesForPhase, +ADVISOR_SKILLS_LIMIT |
| `src/facade/langGraph/search-graph/nodes/show-answer.ts` | state.answerText |
| `src/facade/langGraph/search-graph/response-builders.ts` | state.answerText |
| `src/facade/langGraph/search-graph/advisor-context-builder.ts` | +ADVISOR_SKILLS_LIMIT, CandidateBase |
| `src/telegram-bot/handlers/start.ts` | try-catch для cancel_all_graphs |
| `package.json` | facade:rebuild + bot:docker:restart |

**Результат:** GramJS тест 6/6 ✅, Step 6 показывает advisor answer, salary с USD везде

---

## Осталось сделать

### Финал

- [ ] Записать Video 1 (adhoc, ≤3.5 мин)
- [ ] Записать Video 2 (cold-start + DTW + PDF, ≤5.5 мин)

### Tech Debt

- [ ] FEAT-057: Goal как graph properties
- [ ] FEAT-058: Удалить абстракцию Phases

---

## Рефлексия сессии (Phase 7.8)

### Anti-patterns

60. **Разные имена для одного поля** — `currentAnswer` в state, `answerText` в response. LLM путался. Урок: **одно поле = одно имя везде**

61. **ADHOC_OPTIONAL_FIELDS без describe()** — добавил поля в массив но забыл `.describe()` с USD. Урок: **при добавлении optional field — проверить describe() в Zod schema**

62. **Generate-answer использовал waymatesResults всегда** — не проверял phase. Для pathfinders нужны pathfinderResults. Урок: **при работе с candidates — проверять какой phase активен**

63. **facade:rebuild не перезапускал бота** — старые MCP connections оставались. Урок: **при пересборке facade — перезапустить всех клиентов (bot)**

64. **Hardcoded slice(0, 5)** — не использовал константу. Урок: **magic numbers → константы**

65. **NLP требовал optional fields** — NULL в adhocContext интерпретировался как "missing". Урок: **явно указывать в prompts что NULL = OPTIONAL**

---

## Промпт для продолжения после rewind

```
Продолжаем FEAT-055 Demo Video — финализация.

ПРОЧИТАЙ:
1. `/home/alex/projects/WayMatesRemote/sessions/2025-12-31-feat055-demo-video.md` — Phase 7.8 ЗАВЕРШЕНО

**Сделано в Phase 7.8:**
- ADHOC_OPTIONAL_FIELDS + salaryMin/salaryMax ✅
- USD везде (7 мест) ✅
- Ask intent Step 6 fix (currentAnswer → answerText унификация) ✅
- getCandidatesForPhase() — advisor по правильным candidates ✅
- ADVISOR_SKILLS_LIMIT константа ✅
- NLP не требует optional fields ✅
- facade:rebuild перезапускает бота ✅
- GramJS тест 6/6 ✅

**Осталось:**
- Записать Video 1 (adhoc, ≤3.5 мин)
- Записать Video 2 (cold-start + DTW + PDF, ≤5.5 мин)

**Тесты:**
set -a && source .env.test && set +a
OPENROUTER_API_KEY=sk-or-v1-... npx tsx poc/demo-video-1-telegram.ts
```
