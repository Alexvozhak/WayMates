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

### Phase 6.14: Pathfinder search debugging (текущая сессия)

**Статус:** В процессе — найдена но НЕ решена root cause

**Проблемы найдены и исправлены:**

1. **Roles verified=false** — после `import-demo-fixtures.ts` roles пересоздаются с `verified=false` через `persistence.ts`. Normalizer не может найти "manager" в словаре → role отфильтровывается.
   - **Fix:** Запускать `db:test:init` ПОСЛЕ `import-demo-fixtures.ts`
   - **Изменённые файлы:** нет (workflow fix)

2. **userContext → adhocContextBase conversion** — pathfinder search в profile mode передавал `userContext` (с extra полями contextId, dates) вместо `adhocContextBase` в Core.
   - **Fix:** `adhocContextBase.parse(userContext)` в `search-pathfinders.ts:29`
   - **Изменённые файлы:** `src/facade/langGraph/search-graph/nodes/search-pathfinders.ts`

3. **Мусорные users в БД** — adhoc/cold-start batch tests создают users которые остаются и попадают в результаты следующих поисков.
   - **Fix:** Чистить users перед batch test: `MATCH (u:User) WHERE NOT u.userId STARTS WITH 'usr_019b0055' DETACH DELETE u`
   - **Открытый вопрос:** Добавить cleanup в batch test setup?

**Проблема НЕ решена:**

Pathfinder search через API возвращает 0 results, хотя:
- Cypher напрямую в MCP Neo4j находит 4 pathfinders ✅
- queryParams в Core логируются корректно ✅
- `referenceContext` конвертируется правильно ✅

**Debug logging показал:**
```
[SearchManager] pathfinder Cypher returned 0 records
```

**Гипотеза:** Проблема в том как Neo4j интерпретирует `$referenceContext.position` в WHERE clause. Cypher использует object property access (`$referenceContext.position`), но при передаче через tRPC/Neo4j driver что-то теряется.

**Созданные артефакты:**
- `poc/test-pathfinder-search.ts` — quick test без 2-минутного cold-start flow
- Debug logging в `search-manager.ts` и `search-pathfinders.ts`

**TODO для следующей сессии:**
- [ ] Логировать generated Cypher query в search-manager.ts
- [ ] Выполнить ТОТ ЖЕ query с ТЕМИ ЖЕ params напрямую в MCP Neo4j
- [ ] Проверить что `$referenceContext.position` работает в Neo4j driver
- [ ] Если не работает → destructure referenceContext в queryParams

---

## Рефлексия сессии (Phase 6.13-6.14)

### Anti-patterns (Phase 6.13)

15. **Не сравнил промпты перед дебагом** — потратил время на логи facade/core вместо простого diff adhoc vs cold-start промптов. Урок: при расхождении поведения двух flow → сначала сравнить промпты
16. **Добавил неинформативный пример** — `"Software Engineer" → position: "middle" or "senior"` без контекста — ни о чём. Урок: примеры должны быть конкретными с полным контекстом, или вообще не добавлять
17. **Не подумал о переиспользовании** — добавил DECOMPOSITION в cold-start копипастом вместо shared constant. Урок: при дублировании логики → сразу выносить в общий модуль
18. **Normalizer добавляет мусор** — при cold-start normalizer вызывает `normalizeTerm()` который добавляет non-canonical terms если fuzzy match не сработал. Урок: проверять что normalizer не загрязняет словари
19. **Продолжал batch test после первого расхождения** — нужно останавливаться сразу и диагностировать. Урок: первое расхождение = стоп, анализ
20. **Не спросил о возможности унификации** — adhoc и cold-start имеют похожие промпты, но я не предложил их объединить. Урок: при обнаружении дублирования → сразу спросить "можно ли объединить?"

### Anti-patterns (Phase 6.14)

21. **Не проверил Redis cache сразу** — при проблеме с role=null потратил время на debug промптов, когда проблема была в `verified=false` и Redis cache. Урок: при normalizer проблемах → сначала проверить Redis cache и dictionary verified status
22. **Долгий feedback loop** — использовал 2+ минутный cold-start batch test вместо создания quick test script. Урок: для отладки создать minimal reproduction script СРАЗУ
23. **Инкрементальный debug logging** — добавлял logging по одному вместо comprehensive logging сразу. Урок: при непонятном поведении → добавить logging на ВСЕХ уровнях (facade → core → cypher) за один раз
24. **Не понял разницу типов** — userContext ≠ adhocContextBase, типы разные. Урок: при передаче данных между слоями → проверять что типы совместимы
25. **Не логировал generated query** — видел что Cypher возвращает 0, но не видел КАКОЙ query выполняется. Урок: при Cypher debugging → логировать И query И params

---

## Промпт для продолжения после rewind

```
Продолжаем FEAT-055 Demo Video.

ПРОЧИТАЙ ПОЛНОСТЬЮ: `/home/alex/projects/WayMatesRemote/sessions/2025-12-31-feat055-demo-video.md`

**Статус:** Phase 6.14 В ПРОЦЕССЕ. Pathfinder search debugging — найдена но НЕ решена root cause.

**Контекст:**
- demo-adhoc.yaml: 9/9 ✅
- demo-cold-start.yaml: 21/21 ✅ (был один успешный прогон), но после перезапуска инфры → 12/13 fail (chartUrl=null)
- DECOMPOSITION_RULES вынесены в shared, используются в adhoc и cold-start ✅
- userContext → adhocContextBase conversion добавлена ✅

**Нерешённая проблема:**
Pathfinder search через API возвращает 0 results:
- Cypher напрямую в MCP Neo4j находит 4 pathfinders ✅
- queryParams в Core логируются корректно ✅
- `[SearchManager] pathfinder Cypher returned 0 records` ❌

**Гипотеза:** `$referenceContext.position` в WHERE clause не работает через Neo4j driver (object property access).

**TODO (критично):**
- [ ] Логировать generated Cypher query в search-manager.ts
- [ ] Выполнить ТОТ ЖЕ query с ТЕМИ ЖЕ params напрямую в MCP Neo4j
- [ ] Если `$referenceContext.position` не работает → destructure referenceContext в queryParams

**Quick test (без 2-минутного cold-start):**
```bash
set -a && source .env.test && set +a && npx tsx poc/test-pathfinder-search.ts
```

**Перед тестом — cleanup:**
```cypher
MATCH (u:User) WHERE NOT u.userId STARTS WITH 'usr_019b0055' DETACH DELETE u
```

**Ключевые файлы:**
- `src/core/search-manager.ts` — debug logging добавлен
- `src/facade/langGraph/search-graph/nodes/search-pathfinders.ts` — adhocContextBase.parse() добавлен
- `poc/test-pathfinder-search.ts` — quick test script
```
