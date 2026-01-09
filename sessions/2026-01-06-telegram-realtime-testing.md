# Session: Telegram Real-Time Testing via GramJS CLI

**Даты:** 2026-01-06 → 2026-01-09
**Фокус:** Интерактивное тестирование cold-start и search через реальный Telegram + итеративная отладка

---

## Предыстория

FEAT-059 Demo Video UX Fixes почти завершён. Phase 5 (Vision для Charts) отложен на post-MVP. Нужно было проверить что cold-start и search flows работают корректно через реальный Telegram бот.

**Проблема:** Статичный batch test не гарантирует корректность из-за недетерминированности LLM extraction.

**Решение:** Интерактивное тестирование через GramJS CLI (`poc/telegram-chat.ts`) + итеративная отладка промптов.

---

## Коммиты

| Hash | Описание |
|------|----------|
| `53061b7` | fix(cold-start): improve extraction quality and UX |
| `0412659` | Goal MERGE fix, hasValue(), DECOMPOSITION_RULES |
| `6b52535` | fix(nlp): cold-start clarity + intent recognition + brand terms |
| `9377033` | fix(search): clear answerText on mode switch + omit null fields |
| `af04f19` | fix(nlp): prevent context mixing from candidates data |
| `47b9a16` | refactor(env): explicit config, waymatesOnly filter, R2 required |
| `9f0a400` | refactor(chart): isWaymate → candidateType + cleanup |

---

## Архитектурные изменения

### Session Refactor
- grammY session middleware убран
- Facade = единственный source of truth (Postgres)
- Бот stateless, каждый запрос → `register_telegram` → fresh session

### Locale (ISO 639-1)
- 182 языка через `iso-639-1` пакет
- LLM-контент: locale в промпт, LLM переводит
- Static/Chart: ru/en с fallback на en

### Env Refactor
- NO DEFAULTS — explicit required для всех env переменных
- Fail fast: facade падает если конфигурация неполная
- R2 required — facade не запустится без R2

### Search
- **waymatesOnly flag:** Core фильтрует `isWaymate=true` ДО pathLimit
- `CANDIDATES_DISPLAY_LIMIT` вынесен в env (default 10)

### Cold-Start
- **Trail collection FROZEN** (закомментировано с `// FROZEN:`)
- **Structured preview:** `startYear`, `endYear`, `title` вместо string с `.describe()`
- **hasValue()** shared utility в `state-utils.ts`

### NLP
- **FIELD_DISPLAY_NAMES:** human-readable labels в `shared/prompts.ts`
- **BRAND_TERMS:** Pathfinders, Waymates не переводятся
- Informal tone (ты вместо Вы)
- Omit null fields у кандидатов

---

## E2E Tests Passed

**Adhoc flow:**
```
/start → "2" → adhoc context → explore → goal → save → pathfinders → waymates
```

**Cold-start flow:**
```
/start → PDF upload → 3 positions confirmed → save
```

---

## Phase 17: Chart Refactoring (2026-01-09)

### Сделано

**1. isWaymate → candidateType (13 файлов):**
- `chart/types.ts`: +ChartCandidate, +CandidateType ("pathfinder" | "waymate")
- `ProcessedTrajectory.isWaymate` → `candidateType: CandidateType | null`
- `SimilarityMetrics.isWaymate` → `candidateType`
- Chart модуль отвязан от бизнес-типа WaymateCandidate

**2. chart-utils.ts:**
- MS_PER_MONTH константа вместо magic number
- Union упрощён: 3 типа → 1 с discriminated union
- +waymateToChart(), +pathfinderToChart(), +matchedToChart()

**3. Width упрощение:**
- Все кандидаты: width=2
- User: width=2.5 (остаётся выделен)

**4. Рудименты удалены:**
- `_existingGoal` из transformer (прокидывался но не использовался)
- `existingGoal` полностью из chart модуля (определён в 3 местах, нигде не использовался)

**5. Goals в demo fixtures:**
- Интегрировано в `import-demo-fixtures.ts`
- `setup-waymate-goals.ts` удалён
- `latest-news.md` обновлён

### Изменённые файлы

```
chart/types.ts, chart/index.ts, chart/builders/chart-builder.ts
chart/services/trajectory-transformer.ts, overlap-calculator.ts
chart/builders/html-renderer.ts
facade/langGraph/search-graph/chart-utils.ts
nodes/search-pathfinders.ts, search-waymates.ts, validate-goal.ts, explore.ts
poc/chart-smoke-test.ts
scripts/import-demo-fixtures.ts
mvp-test-final/latest-news.md
```

---

## Phase 18: UX Fixes (2026-01-09)

### Сделано

**1. show-results pathfinders bug (FIXED):**
- `show-results.ts` передавал `waymatesResults` для ВСЕХ phases
- Fix: `getResultsByPhase()` → pathfinderResults для `showing_pathfinder_results`

**2. salaryMin/Max normalization (FIXED):**
- `normalizer.ts`: `0 ?? null` = `0` (проблема)
- Fix: `0 || null` = `null` (falsy → null)
- Причина: LLM extraction возвращает `0` когда salary не указан

**3. Block startStory для users с profile (FIXED):**
- `flow-guard-checker.service.ts`: добавлена проверка
- Если hasContext=true и intent=startStory → показать greeting menu
- Причина: "1" после greeting классифицировался как startStory (создание профиля) вместо search

**4. Conversational prompts (FIXED):**
- `prompts.ts`: GUARD_TEMPLATES переписаны без нумерованных списков
- Разговорный стиль: "Ready to search?" вместо "1. Search 2. Change goal..."
- Причина: нумерация провоцировала ответы "1", "2" — LLM без контекста неправильно интерпретировал

**5. Brand terms preservation (FIXED):**
- `buildGuardTranslationPrompt()`: добавлено правило CRITICAL: Do NOT translate brand terms
- BRAND_TERMS = ["Pathfinders", "Waymates", "WayMates"]
- Причина: LLM переводил как "проводники", "попутчики"

**6. Dead code cleanup:**
- `schemas.ts`: удалён `getGoalResponseSchema` (определён но не импортировался)

**7. Adhoc flow E2E — PASSED:**
- explore(8) → goal → waymates(5) → question → pathfinders(4) → question

### Изменённые файлы

```
src/facade/langGraph/search-graph/nodes/show-results.ts
src/facade/services/normalizer.ts
src/facade/services/orchestrator/flow-guard-checker.service.ts
src/facade/services/orchestrator/intent-classifier.ts
src/facade/services/nlp-formatter/prompts.ts
src/shared/schemas.ts
```

### Известные проблемы

1. **Intent "найди попутчиков" → unknown**
   - `parse_search_intent` (search-graph classifier) не знает русские синонимы
   - Решение: НЕ добавлять костыли — использовать brand terms (Waymates/Pathfinders)

2. **Locale неразбериха**
   - Telegram передаёт `language_code: "en"` из user settings
   - Но общение на русском → LLM теряется
   - Решение: либо детектировать язык сообщения, либо всегда использовать brand terms

3. **Cold-start extraction**
   - domains из PDF не совпадают с эталоном (LLM limitation)
   - Исправлял вручную в БД для теста

---

## TODO (Phase 19)

1. **Cold-start flow E2E** — завершить после fix locale
2. **Chart verification** — ru/en локали
3. **Locale detection** — определять язык из сообщения, не из Telegram settings

---

## Алгоритм тестирования (для следующей сессии)

### Подготовка

```bash
# 1. Проверить инфру
docker ps | grep waymates  # должно быть 6 контейнеров

# 2. Проверить данные
# Neo4j MCP:
MATCH (u:User) WHERE u.userId STARTS WITH 'usr_019b0055' RETURN count(u)  # 11 demo users
MATCH (u:User)-[:HAS_GOAL]->(g:Goal) RETURN count(u)  # 4 waymates с Goals

# 3. Удалить мусор (если есть)
MATCH (u:User) WHERE NOT u.userId STARTS WITH 'usr_019b0055' DETACH DELETE u
```

### Adhoc Flow

```
1. /start → greeting (разговорный, без номеров)
2. "quick search" или "опиши позицию" → adhoc context prompt
3. Ввести: "Technical PM, manager, fintech, RU"
4. "explore" или "покажи похожих" → showing_exploration_candidates (>4)
5. "head of engineering, NL, AI" → showing_goal
6. "save" → asking_search_mode
7. "Waymates" → showing_waymate_results (4)
8. Вопрос → advisor answer
9. "Pathfinders" → showing_pathfinder_results (4)
10. Вопрос → advisor answer
```

### Cold-Start Flow

```
1. /start → greeting
2. "share career" или отправить PDF → cold-start graph
3. PDF: Profile.pdf → preliminary plan (3 позиции)
4. "confirm" → clarify каждую позицию
5. Уточнить до соответствия Demo-Alex.json
6. "save" → career saved, asking_search_mode
7. Далее как adhoc flow (Waymates → Pathfinders)
```

### ВАЖНО: Brand Terms

- **Всегда использовать:** Pathfinders, Waymates, WayMates
- **Никогда:** проводники, попутчики, fellow travelers
- LLM НЕ должен переводить эти термины

---

## Связанные документы

- **Рефлексии:** `.claude/context/guidelines.md`
- **Архитектура:** `mvp-test-final/KNOWLEDGE-BASE.md`
- **Бизнес-логика:** `mvp-test-final/BUSINESS-LOGIC-MVP.md`

---

## Phase 19: Search & Cold-Start Fixes (2026-01-09)

### Коммиты

| Hash | Описание |
|------|----------|
| `b049606` | fix(search): NLP results display + setGoal MERGE + intent classifier |

### Сделано

**1. setGoalQuery MERGE fix:**
- Было: DELETE + CREATE → constraint conflict при повторном save
- Стало: MERGE User → MERGE Goal → MERGE relationship
- Причина: UNIQUE constraint на Goal.userId не позволял DELETE+CREATE в одной транзакции

**2. NLP results phases fix:**
- Было: `adhocContext: state.adhocContext` → LLM видел optional fields и спрашивал их
- Стало: `adhocContext: null` для showing_waymate_results и showing_pathfinder_results
- Причина: NLP игнорировал "DO NOT ask for fields" когда видел adhocContext в данных

**3. NLP prompts усиление:**
- "CRITICAL: DO NOT ask for any fields!" перенесено В НАЧАЛО промптов для results phases
- PHASE_CONTEXT усилен: "Any question = ask (NOT done)"

**4. Intent classifier (orchestrator):**
- startAdhoc vs startStory: добавлен priority rule
- "stating current position = startAdhoc, startStory requires EXPLICIT intent"
- Причина: "I am PM" классифицировался как startStory

**5. NLP missing fields format:**
- ❗ вместо ❌ для missing required fields

**6. Cold-start edit fix:**
- Было: `parsedDecision.editInstructions` — LLM генерировал краткое резюме
- Стало: `state.userResponse` — полный текст пользователя передаётся в correction prompt
- Причина: "Remove skills" вместо "skills: typescript, nestjs, postgresql, docker"

**7. Chart extractGrade fix (IN PROGRESS):**
- Было: `extractGrade("head of engineering")` → "middle" (no keyword match)
- Стало: `ctx.position` напрямую (без extractGrade)
- `extractGoalValues` → `targetContext.position.values[0]` напрямую
- Labels: "Грейд/Grade" → "Позиция/Position"

### Cold-Start E2E — PASSED

```
PDF → 3 контекста → edit до эталона Demo-Alex.json → save → goal → waymates(5) → pathfinders(4)
```

**Эталон достигнут:**
| # | Position | Role | Domains | Skills | Industry | Size |
|---|----------|------|---------|--------|----------|------|
| 1 | middle | developer | backend, mobile | c++, python, qt5, android | technology | small |
| 2 | team lead | developer | backend, security | typescript, nestjs, postgresql, docker | technology | medium |
| 3 | technical project manager | manager | management, backend | typescript, python, go, docker, terraform, prometheus | fintech | large |

### Изменённые файлы

```
src/cypher/queries/goals.ts — setGoalQuery MERGE
src/facade/langGraph/search-graph/response-builders.ts — adhocContext: null
src/facade/services/nlp-formatter/prompts.ts — CRITICAL prefix, ❗ format
src/facade/langGraph/search-graph/prompts/classification.ts — PHASE_CONTEXT
src/facade/services/orchestrator/intent-classifier.ts — startAdhoc priority
src/facade/langGraph/cold-start-v2/nodes/edit-context.ts — userResponse вместо editInstructions
src/chart/config/aspect-configs.ts — extractValue без extractGrade
src/chart/index.ts — extractGoalValues без extractGrade
```

---

## Phase 20: Chart Domain Filtering + Routing Fix (2026-01-09)

### Коммиты

| Hash | Описание |
|------|----------|
| `77c30e6` | feat(chart): remove extractGrade, filter domains by goal |
| `e527851` | fix(search-router): allow setGoal when user already has goal |

### Сделано

**1. extractGrade удалён:**
- Функция удалена из `aspect-configs.ts`
- Export удалён из `chart/index.ts`
- `extractGoalValues` использует `position.values[0]` напрямую
- Labels: "Грейд/Grade" → "Позиция/Position"

**2. Domain filtering by goal:**
- `AspectConfig.extractValue` теперь принимает `goalValues` параметр
- `domains.extractValue`: если goal domain есть в ctx.domains → показать его
- goalValues прокинут через `chart-builder` → `transformer` → `extractPointValues`
- **Результат:** chart показывает "ai" для кандидатов с `["management", "ai", "platform"]` когда goal domain = "ai"

**3. Routing fix — setGoal с существующим goal:**
- Баг: `setGoal` intent из `confirming_adhoc_context` → fallback на `cancel`
- Причина: `CONFIRMING_WITH_GOAL_ROUTES` не имел mapping для `setGoal`
- Fix: добавлен `setGoal: NODE.extract_goal`

### E2E Test — PASSED

```
adhoc context → goal (CTO, NL) → save → "change goal to head of engineering, DE, AI" → NEW goal shown (NOT cancel!)
pathfinders: 4 found, chart generated with correct domain filtering
```

### Изменённые файлы

```
src/chart/types.ts — extractValue signature + GoalValues
src/chart/config/aspect-configs.ts — extractGrade removed, domains filter by goal
src/chart/index.ts — export cleanup
src/chart/builders/chart-builder.ts — goalValues passed to transformer
src/chart/services/trajectory-transformer.ts — goalValues through chain
src/facade/langGraph/search-graph/search-router.ts — setGoal in CONFIRMING_WITH_GOAL_ROUTES
```

---

## Phase 20.1: NLP Locale & Format (2026-01-09)

### Коммит

| Hash | Описание |
|------|----------|
| `10d5900` | fix(nlp): strict locale, unified context format, clear options |

### Сделано

**1. Strict locale:**
- `buildLanguageInstruction(locale)` — строго следовать Telegram locale
- "STRICT — always respond in this language regardless of user's message language"
- Раньше LLM отвечал на языке сообщения, теперь — на языке из Telegram settings

**2. CONTEXT_FORMAT (DRY):**
- Единая константа для `asking_adhoc_context` и `confirming_adhoc_context`
- Header: "📝 Your current context:"
- ❗ только если missingFields не пуст
- ⚪ без двоеточий

**3. Clear options:**
- `showing_goal`: "validate (check if people reached this goal), refine (add details), or save (confirm and search)"
- `confirming_adhoc_context`: "explore OR set a career goal"

### Изменённые файлы

```
src/facade/services/nlp-formatter/prompts.ts — buildLanguageInstruction, CONTEXT_FORMAT, clear options
```

---

## TODO (Phase 21)

1. **Cold-start полный E2E тест:** PDF → Demo-Alex.json эталон → waymates → pathfinders
2. **Chart визуальная проверка** — screenshot через puppeteer (опционально)

---

## Prompt для продолжения после rewind

```
Продолжаем Phase 21. Session: sessions/2026-01-06-telegram-realtime-testing.md

Phase 20 + 20.1 ЗАКОММИЧЕНЫ:
- 77c30e6: chart extractGrade удалён, domain filtering by goal
- e527851: routing fix — setGoal с существующим goal
- 10d5900: NLP strict locale, CONTEXT_FORMAT (DRY), clear options

NLP улучшения:
- Strict locale: ответ строго на языке из Telegram settings
- CONTEXT_FORMAT: единый формат для context phases (header + fields)
- Clear options: пояснения для validate/refine/save

TODO Phase 21:
1. Cold-start полный E2E: PDF → Demo-Alex эталон → search
2. Chart screenshot через puppeteer (опционально)

Эталон Demo-Alex: tests/core/fixtures/Demo-Alex.json
Инструмент: poc/telegram-chat.ts (НЕ mcp-chat.ts!)
Команды: npm run facade:rebuild:clean, docker ps | grep waymates
```
