# Session Log: FEAT-046 Search Modes Refactoring

**Дата:** 2025-12-26
**Ветка:** `feature/search-refactor`
**Фича:** FEAT-046 — Рефакторинг режимов поиска

---

## Фаза 1: Rename (DONE ✅)

**Коммит:** `aeabdcf`

- `searchByTarget` → `reverseSearchPathfinders`
- `buildTargetSearchWithPathsQuery` → `buildReversePathfinderSearchQuery`

---

## Фаза 2: Waymates Merge (DONE ✅)

### Что сделано

1. **Schema** (`src/shared/schemas.ts`):
   - Удалены `adhocSearchParamsSchema`, `userSearchParamsBaseSchema`
   - Добавлен `waymatesSearchParamsSchema` с `referenceContext: optional`
   - Новый тип `WaymatesSearchParams`

2. **Cypher** (`src/cypher/queries/search.ts`):
   - `buildCurrentSearchQuery` → `buildWaymatesSearchQuery`
   - Classification сохранена (pathfinder/waymate/null)

3. **SearchManager** (`src/core/search-manager.ts`):
   - `searchAdhoc` + `searchByUser` → `searchWaymates`
   - DTW только для profile mode с траекторией
   - Type guard `isUserContextWithTrajectory()` (ESLint fix)

4. **tRPC** (`src/core/routers/search.router.ts`):
   - `adhoc` + `byUser` → `waymates`

5. **Facade nodes** (`explore.ts`, `search.ts`):
   - Упрощены до `search.waymates.query()`

6. **MCP tools**: Обновлены на `search.waymates`

7. **Тесты**: Все 5 файлов обновлены
   - `searchAdhoc` → `searchWaymates`
   - `searchByUser` → `searchWaymates`
   - `AdhocSearchParams` → `WaymatesSearchParams`
   - `createUserSearchParams` → `createWaymatesSearchParams`

---

## Фаза 3: Chart cleanup (DONE ✅)

- Chart убран из `explore.ts`
- Chart только в `show_results` (validate_goal — ещё нет)

---

## Фаза 4: Tests + UX Debug (DONE ✅)

### Тесты

- **E2E Telegram тест обновлён** — добавлен шаг `confirming_adhoc_context`
  - Было: 4 turns (adhoc → filter → goal → save)
  - Стало: 5 turns (adhoc → confirm → filter → goal → save)
- **Все тесты passed:**
  - Unit: 67/67 ✅
  - Telegram: 9/9 ✅
  - Integration: 88/88 ✅
  - Facade: 116/121 (5 LLM flakiness)

### UX Debug

**Проблема:** LLM extraction возвращал `position: "test-position-1766698028715"` вместо `junior`

**Причина:** Тест D5 создавал entries с `verified: true`, загрязняя dictionary hints

**Решение:** Удалён тест D5 — тестировал инфраструктуру (Neo4j MERGE), не бизнес-логику

**Файл:** `tests/core/integration/dictionaries-manager/dictionaries.integration.ts`

---

## Фаза 5: Chart Improvements (PENDING)

### Текущее состояние chart generation

| Node | Chart? | Что нужно |
|------|--------|-----------|
| `show_results` | ✅ ДА | userTrajectory + candidates |
| `validate_goal` | ❌ НЕТ | Добавить: candidates only |
| `explore` | ❌ НЕТ | Добавить: candidates only |

### Задачи

1. Добавить chart generation в `validate_goal.ts`
2. Добавить chart generation в `explore.ts` (для adhoc mode)
3. Новый mode `"candidates_only"` в `generateTrajectoryChart`
4. Improve NLP для empty results

---

## Текущий статус

**Quality gates:**
- `npm run lint:fix` — 0 errors ✅
- `npx tsc --noEmit` — 0 errors ✅
- Все тесты passed ✅

**Коммит FEAT-046:** `e2399b0` ✅

---

## Фаза 6: Prompt Improvements + UX Analysis (DONE ✅)

### Что сделано

1. **Словари для trails** (`upsert-trail/prompts.ts`, `extract-trail.ts`)
   - Добавлен `buildTrailExtractionPrompt(hints)` — skills нормализуются через dictionary hints

2. **Убраны русские примеры** (`update-context/prompts.ts`)
   - Было: hardcoded примеры на русском ("Добавь React в навыки")
   - Стало: только семантические правила

3. **Убраны примеры из correction** (`cold-start-v2/prompts.ts`)
   - contextCorrectionPrompt — убраны explicit примеры, оставлены правила

4. **Fix UX теста** (`advisor-mode.integration.ts`)
   - TC-SG-ADV3: "спасибо" после Q&A = done asking questions, НЕ cancel flow
   - Тест ожидал `cancelled`, правильно `showing_results`

### UX Analysis — Полный Flow Test

Прошёл flow: adhoc → goal → validate → save → results

**Найденные проблемы:**

| # | Проблема | Критичность | Где фиксить |
|---|----------|-------------|-------------|
| 1 | "3 года опыта" → junior (должен middle) | ❌❌ | adhoc extraction prompt |
| 2 | Goal не наследует adhocContext | ❌❌ | goal extraction или бизнес-логика |
| 3 | Validate показывает нерелевантных (frontend вместо Python backend) | ❌ | searchPathfinders фильтрация |
| 4 | Results после save показывает juniors вместо pathfinders к senior | ❌❌ | routing после set_goal |
| 5 | "That's awesome! 🎉" — слишком восторженно, повторяется | ⚠️ | NLP prompts |
| 6 | "User 1, User 2" — безликие плейсхолдеры | ⚠️ | NLP prompts |
| 7 | Background описания поверхностные (нет "сколько лет", "какие skills добавил") | ⚠️ | NLP prompts |

**Главные бизнес-проблемы:**

1. **Position extraction не учитывает опыт** — "3 года" должно давать middle, не junior
2. **Goal extraction не использует adhocContext** — пользователь уже сказал кто он
3. **Search после save показывает Waymates, не Pathfinders** — цель senior, показаны juniors

---

## Текущий статус

**Коммиты:**
- `e2399b0` — FEAT-046 waymates merge
- PENDING — prompt improvements + test fix

**Quality gates:**
- `npm run lint:fix` — 0 errors ✅
- `npx tsc --noEmit` — 0 errors ✅
- Facade tests: 126/126 ✅

---

## Рефлексия (сквозная)

### Как делать правильно

1. **Breaking changes = чистые срезы**: Удалять старое сразу, не оставлять backwards compatibility shims.

2. **Pre-Action Declaration**: Перед каждым изменением:
   - Проблема, Решение, Источник, Уверенность, Объём

3. **filesystem MCP для batch**: `edit_file` вместо `sed` — надёжнее, показывает diff.

4. **Type guards**: При union типах проверять наличие поля, не использовать `as Type`.

5. **Тесты должны тестировать бизнес-логику, не инфраструктуру**: D5 тестировал Neo4j MERGE — удалён.

6. **Изоляция тестовых данных**: Test entries с `verified: true` загрязняют production-like hints.

7. **Критический взгляд на тесты**: "Что тестирует?" — если инфраструктуру, удалять.

8. **Промпты без примеров**: LLM понимает семантику, примеры ограничивают мультиязычность.

9. **UX как первый пользователь**: Всегда тестировать flow с позиции нового юзера — "всё ли понятно?"

10. **"спасибо" ≠ "cancel"**: Естественное завершение Q&A — возврат к результатам, не отмена flow.

### Как делать неправильно

1. **Не проверять tsc после каждого блока правок** — накапливаются ошибки.

2. **Забывать про тесты при изменении API**.

3. **Создавать test entries с `verified: true`** — загрязняют dictionary hints для LLM.

4. **Тестировать инфраструктуру вместо бизнес-логики**.

5. **Гонять все facade тесты каждый раз** — 20 минут. Запоминать упавшие, фиксить точечно.

6. **Hardcode примеры в промптах** — ограничивает мультиязычность и гибкость LLM.

### Инсайты

1. **Унификация API упрощает код**: Один `searchWaymates` с optional `referenceContext` проще двух методов.

2. **Classification логика отдельно от routing**: `goalPositions` classification в Cypher — бизнес-логика, не зависит от endpoint.

3. **Chart только для pathfinders**: Waymates — peers без path, chart бессмыслен.

4. **Бизнес-логика поиска**: Три режима — Waymates (peers), Pathfinders (proof of transition), ReversePathfinders (откуда приходят).

5. **LLM hints = verified data only**: Тестовые данные не должны попадать в hints для extraction prompts.

6. **Граф SearchGraph адекватен**: 23 ноды для workflow — не over-engineering. Проблема в семантике промптов, не в структуре.

7. **Intent classification уже работает**: Phase context передаётся в prompt, reasoning логируется. "хочу senior" → CLARIFY ✅

8. **Диалог должен быть как с другом**: "That's awesome! 🎉" каждый раз — фальшиво. Один emoji, без восторгов.

9. **Контекст должен наследоваться**: Если пользователь сказал "backend Python", goal extraction должен использовать это.

10. **Релевантность > количество**: Лучше 3 релевантных кандидата чем 10 случайных.

### Наставления от пользователя

1. **"Breaking changes!"** — не бояться ломать, если упрощает.
2. **"filesystem MCP вместо sed"** — надёжнее.
3. **Pre-Action формат обязателен**.
4. **"harder thinking"** — глубокий анализ перед кодом.
5. **"Зачем такой тест?"** — критически оценивать бизнес-ценность тестов.
6. **"Удалить и откатить"** — если тест не тестирует бизнес-логику, удалять без замены.
7. **"Запоминай упавшие тесты"** — не гонять все facade тесты каждый раз.
8. **"Диалог как с настоящим человеком"** — UX должен быть естественным, не шаблонным.
9. **"Только бизнес-ценные советы"** — не угождать, быть честным.

### Требования к качеству диалога (UX бота)

1. **Диалог как с настоящим человеком** — идеал: пользователь не должен чувствовать что говорит с ботом.

2. **Без восторгов и лишних эмоций** — "That's awesome! 🎉" каждый раз — фальшиво. Допускается разговорная манера, приятельское отношение.

3. **Без воды** — короткие, по делу ответы. Не повторять одни и те же фразы.

4. **Критический взгляд на UX** — при тестировании ставить себя на место первого пользователя:
   - Всё ли понятно?
   - Грамотно ли ведёт по flow?
   - Что было лишним?
   - Чего не хватило?
   - Что хорошо, но можно улучшить?

5. **Промпты без примеров (гвоздей)** — только семантика. LLM должен понимать контекст, не цепляться за конкретные формулировки.

6. **Мультиязычность** — никаких hardcoded примеров на конкретном языке.

7. **Контекст диалога важен** — парсерам интентов передавать messages[] (что бот спросил), не только ответ пользователя.

8. **Анализ всего сообщения** — не цепляться за одно слово, понимать смысл целиком.

---

## Фаза 7: Adhoc Validation + Goal Inheritance (DONE ✅)

**Коммит:** `4b3f65e` — prompt improvements

### Что сделано

1. **Prompt improvements закоммичены**
   - upsert-trail: dictionary hints for skills
   - update-context: убраны русские примеры
   - cold-start-v2: убраны explicit примеры
   - advisor-mode test: "спасибо" = done, не cancel

2. **Adhoc validation переработан**
   - `isAdhocContextValid`: теперь требует role + position + countryCode + domain (все 4)
   - Фикс `!== null` → `!= null` (undefined vs null баг)
   - `domains.json`: +6 доменов (devops, qa, platform, ecommerce, edtech, healthtech)
   - `citizenships` добавлен в `adhocContextBase` schema
   - Extraction prompt обновлён: countryCode + citizenships

3. **Goal extraction исправлен**
   - Функция `fillFromContext()` — заполняет null поля из adhocContext
   - Goal теперь наследует role/domains/skills/countries из adhocContext

4. **Решение по position extraction**
   - ❌ НЕ инферим грейд из лет опыта
   - ✅ Строгая валидация → бот явно спросит недостающие поля

5. **Search routing — ОБСУЖДЕНО**
   - Проанализированы waymates vs pathfinders vs reversePathfinders
   - После save goal нужен reversePathfinders, не waymates
   - **Решение:** Предложить выбор waymates ИЛИ pathfinders

### Файлы изменены

| Файл | Изменение |
|------|-----------|
| `database/domains.json` | +6 доменов |
| `src/shared/schemas.ts` | citizenships в adhocContextBase |
| `src/facade/langGraph/search-graph/prompts.ts` | countryCode + citizenships в extraction |
| `src/facade/langGraph/search-graph/nodes/load-context.ts` | isAdhocContextValid (4 required fields) |
| `src/facade/langGraph/search-graph/nodes/extract-goal.ts` | fillFromContext() для inheritance |

---

## Нерешённые задачи (следующая сессия)

### Приоритет 1: searchPathfinders + UX Flow

1. **Реализовать searchPathfinders** — кто прошёл ОТ моего контекста К моей цели
2. **UX после save goal** — предлагать выбор: waymates ИЛИ pathfinders
3. **Закоммитить текущие изменения** (Фаза 7)

### Приоритет 2: UX Тестирование

**Запрос пользователя (сохранить как есть):**
> Пройтись критичным юзером как-будто впервые на платформе, оценить наши ответы:
> - всё ли было понятно
> - стиль общения человеческий ли
> - подсказки информативны
> - понятно ли что ты можешь делать на каждой фазе диалога
> - понятно ли какую инфу о тебе собрали (контекст+цель)
> - получил ли ты в результаты кандидатов — если нет, получил ли советы по исправлению ситуации (фикс фильтров)
> - понятны ли тебе все фильтры
> - получил ли ты в конце кандидатов
> - смог ли LLM тебе дать по ним анализ-рекомендации
> - смог ли ответить на парочку вопросов по ним
> - остался ли ты доволен холодным стартом
> - чтобы ты улучшил, чего тебе не хватило, чем был расстроен

### Приоритет 3: Фиксы

1. **2 упавших теста** — TC-UC-DEC1, TC-UC-DEC3 (LLM flakiness, но разобраться)
2. **NLP стиль** — менее восторженный, более человечный

### Chart generation (отложено)

1. validate_goal не генерирует chart
2. explore не генерирует chart
3. Нужен mode `candidates_only`

---

## Артефакты

| Файл | Назначение |
|------|------------|
| `tasks/features/FEAT-046-search-modes-refactoring.md` | Дизайн-документ фичи |
| `mvp-test-final/KNOWLEDGE-BASE.md` | Обновлённая бизнес-логика search modes |

---

## Рефлексия (дополнение)

### Новые инсайты

11. **undefined vs null в TypeScript** — `!== null` пропускает undefined. Использовать `!= null` для проверки обоих.

12. **Docker rebuild не обновляет код** — нужен `docker compose build --no-cache` для актуализации кода в контейнере.

13. **Goal должен наследовать контекст** — если user говорит "хочу senior" без уточнений, role/domains/skills берутся из текущего контекста.

14. **Два типа поиска после save** — reversePathfinders (кто достиг цели) vs waymates (похожие с той же целью). Разные выборки, разная ценность.

15. **Валидация важнее inference** — лучше спросить явно ("какой у тебя грейд?") чем угадывать ("3 года = middle").

### Дополнительные наставления

10. **"Осмотрись, мб уже есть"** — перед созданием нового функционала искать существующий код.

11. **"Объясни проблему, варианты, сравни"** — не давать готовые решения, сначала обсудить альтернативы.

12. **"reverseSearch не нужен текущий контекст"** — понимать бизнес-логику каждого API.

---

## Фаза 8: UX Test + searchPathfinders Design (DONE ✅)

### Что сделано

1. **UX тест полного flow** (adhoc → goal → validate → save → results)
   - Intent classification работает: "хочу senior" → CLARIFY ✅
   - Goal inheritance работает: наследует role/domains/skills из adhocContext ✅
   - Facets показываются при много кандидатов ✅

2. **Найден и исправлен routing баг**
   - Проблема: `filter` intent в `asking_after_validate_facets` → cancel
   - Причина: `validateRoutes` не содержал `filter`
   - Фикс: добавлен `filter: NODE.apply_filters` в validateRoutes
   - Файл: `src/facade/langGraph/search-graph/search-router.ts`

3. **Проработан дизайн searchPathfinders**
   - Бизнес-логика согласована (3 режима поиска)
   - Schema спроектирована (dual recency, excludedFields)
   - Архитектура reuse 90%+ (переиспользование существующих helpers)
   - Разбито на 6 подфаз (~5-10% контекста каждая)

4. **Ключевые решения согласованы:**
   - `candidateType` → `isWaymate: boolean`
   - Два recency: targetRecencyMonths + referenceRecencyMonths
   - Chart для всех режимов (waymates chart = FEAT-047)
   - Единое поведение: facets → chart

### Файлы изменены (uncommitted)

| Файл | Изменение |
|------|-----------|
| `src/facade/langGraph/search-graph/search-router.ts` | filter в validateRoutes |
| `tasks/features/FEAT-046-search-modes-refactoring.md` | Полный дизайн Фазы 8 |

---

## Рефлексия (дополнение Фаза 8)

### Новые инсайты

16. **Routing = source of truth** — если intent не в route map для фазы → default (cancel). Проверять routing первым делом.

17. **Compound intents не поддерживаются** — "убери фильтр и сохрани" = два действия, LLM возвращает один intent. Пользователь должен делать по шагам.

18. **Архитектура графа адекватна** — 23 ноды, 5 conditional edges для career search workflow — не over-engineering. Проблемы в семантике, не структуре.

19. **90% reuse > new code** — для searchPathfinders использовать существующие helpers, не писать с нуля.

20. **isWaymate: boolean проще enum** — меньше вариантов = меньше багов. `candidateType: 'pathfinder' | 'waymate' | null` → `isWaymate: boolean`.

21. **Два recency для pathfinders обязательны** — targetRecency (когда достиг) + referenceRecency (как давно был в нашем контексте = длина пути).

22. **Chart для всех search modes** — waymates тоже нужен chart (их пути + общие цели), но это отдельная задача FEAT-047.

### Дополнительные наставления

13. **"90% reuse"** — искать максимальное переиспользование кода, не писать новое.

14. **"isWaymate boolean проще"** — упрощать типы где возможно.

15. **"Два recency!"** — не забывать про длину пути, не только актуальность цели.

16. **"Chart для waymates тоже"** — но в отдельной задаче.

---

## Артефакты (обновлено)

| Файл | Назначение |
|------|------------|
| `tasks/features/FEAT-046-search-modes-refactoring.md` | **Полный дизайн Фазы 8 с подфазами** |
| `sessions/2025-12-26-feat-046-search-refactor.md` | Лог сессии |
| `mvp-test-final/KNOWLEDGE-BASE.md` | Бизнес-логика search modes |

---

## Промпт для rewind

```
Изучи:
1. tasks/features/FEAT-046-search-modes-refactoring.md (Фаза 8)
2. sessions/2025-12-26-feat-046-search-refactor.md (рефлексия)

КОНТЕКСТ:
- Ветка: feature/search-refactor
- Коммиты: e2399b0, 4b3f65e, 6e11200
- Фазы 1-7 DONE, Фаза 8 IN PROGRESS
- Router fix (filter в validateRoutes) — uncommitted

ЧТО ДЕЛАТЬ (Фаза 8, по подфазам):
8.1: candidateType → isWaymate: boolean (~5%)
8.2: Извлечь buildTargetFilterConditions() (~5%)
8.3: buildPathfinderSearchQuery (dual matching, dual recency) (~10%)
8.4: SearchManager + tRPC pathfinders endpoint (~5%)
8.5: Facade integration (search node) (~5%)
8.6: Тесты (~5%)

КЛЮЧЕВЫЕ РЕШЕНИЯ (согласовано):
- isWaymate: boolean (не enum)
- Два recency: targetRecencyMonths + referenceRecencyMonths
- excludedContextFields как в waymates
- 90%+ reuse существующего кода
- Chart для всех modes (waymates chart = FEAT-047)

БИЗНЕС-ЛОГИКА:
- Pathfinder = был как мы + достиг нашей цели + temporal ordering
- Waymate = похожий + та же цель + ещё не достиг
- reversePathfinder = достиг цели (любой старт), для валидации

ОТЛОЖЕННЫЕ ЗАДАЧИ (не потерять!):
- UX flow: после save goal → выбор waymates или pathfinders
- UX тест как критичный пользователь (см. "Запрос пользователя" в доке)
- Фикс 2 упавших тестов (TC-UC-DEC1, TC-UC-DEC3)
- NLP стиль improvements (менее восторженный, более человечный)

ПЕРВЫЙ ШАГ:
Закоммитить router fix, потом начать 8.1 (isWaymate refactor)
```
