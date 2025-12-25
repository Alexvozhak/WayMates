# Сессия: FEAT-045 Candidates-Only Chart Integration

**Дата**: 2025-12-25
**Цель**: Интеграция chart для adhoc режима (candidates-only mode)

---

## Фаза 1: Диагностика и исправление

### Что сделано

1. **Исправлена нода для chart** — chart должен быть в `explore.ts` (adhoc flow), не в `validate-goal.ts` (byTarget flow)

2. **Обновлены типы Chart модуля**
   - `chart/types.ts`: `adhocContext: AdhocContextBase` вместо `UserContext`
   - `trajectory-transformer.ts`: добавлена `extractAdhocPointValues()` для AdhocContextBase (без `createdAt`)
   - `chart-builder.ts`: обновлён тип CandidatesOnlyBuildInput

3. **Обновлены типы facets**
   - `facets.ts`: `CandidateWithContext = MatchedCandidateWithPath | ScoredMatchedCandidate`
   - Функции `shouldUseFacets()` и `computeFacets()` принимают оба типа

4. **Рефакторинг архитектуры — бизнес-логика в нодах**
   - Добавлено поле `facets: CandidateFacets | null` в state.ts
   - `explore.ts`: вычисляет `needsFiltering`, записывает `facets` или `chartUrl` в state
   - `validate-goal.ts`: аналогично
   - `response-builders.ts`: только читает из state, без `shouldUseFacets()` логики

5. **Обновлена схема `showing_exploration`**
   - Добавлена `showingExplorationBase` (аналог `askingAfterValidateBase`)
   - Discriminated union по `needsFiltering: true | false`

### Артефакты
- `src/chart/types.ts` — AdhocContextBase для candidates-only
- `src/chart/services/trajectory-transformer.ts` — extractAdhocPointValues()
- `src/facade/langGraph/search-graph/state.ts` — поле facets
- `src/facade/langGraph/search-graph/nodes/explore.ts` — chart + facets логика
- `src/facade/langGraph/search-graph/nodes/validate-goal.ts` — facets логика
- `src/facade/langGraph/search-graph/response-builders.ts` — без бизнес-логики
- `src/shared/schemas.ts` — showingExplorationBase + discriminated union

---

## Что делать дальше

1. **Обновить тесты** — добавить guard `needsFiltering === false` перед доступом к `candidates`
   - `exploration.integration.ts`
   - `e2e.integration.ts`
   - `goal-check.integration.ts`
   - `e2e-search-graph.integration.ts`

2. **Проверить tsc + lint**

3. **Ручное тестирование**
   ```bash
   npm run test:facade:setup
   npx tsx poc/mcp-chat.ts --reset
   npx tsx poc/mcp-chat.ts "я backend разработчик"
   # → должен показать chart или facets в зависимости от кол-ва результатов
   ```

4. **Locale** — сейчас захардкожен `"ru"`, нужно вынести в config или state

---

## Рефлексия

### Как делать правильно

1. **Бизнес-логика в нодах, не в response-builders** — нода вычисляет и записывает в state, response-builder только читает
2. **Производные флаги не хранить** — `needsFiltering` можно вывести из `facets !== null`
3. **Использовать паттерн из load-context.ts** — нода решает на основе условия, записывает результат в state
4. **Проверять ЗО компонентов** — если response-builder содержит `if (shouldUseFacets(...))` — это нарушение
5. **Union типы для кандидатов** — `CandidateWithContext = A | B` вместо дублирования функций

### Как делать неправильно

1. **Chart в validate-goal.ts для adhoc** — adhoc flow это `explore`, не `validate_goal`
2. **Converters для типов** — лучше расширить типы Chart чтобы принимали AdhocContextBase
3. **needsFiltering как отдельное поле state** — производное значение, достаточно `facets`
4. **Логика в response-builders** — это только маппинг state → response

### Инсайты

1. **adhoc users не имеют pathfinders/waymates** — нет траектории для сравнения, `candidateType: null`
2. **AdhocContextBase vs UserContext** — adhoc не имеет `createdAt`, `contextId` и др. обязательных полей
3. **Паттерн RouteFlags** — похожий подход можно использовать для response, но лучше хранить в state
4. **Discriminated union в схеме** — `showingExplorationBase.extend({ needsFiltering: true/false })`

### Наставления от пользователя

1. **"стопе! мы отображаем кандидатов adhoc режима! а не by_target!"** — понял что chart для adhoc, не для byTarget
2. **"needsFiltering разве нужен?"** — производные значения не хранить в state
3. **"почему у нас просачивается логика в response-builders?"** — ЗО: response-builders только читает
4. **"посмотри как раньше мы такие проблемы решали"** — искать паттерны в существующем коде (load-context.ts)

---

## Фаза 2: Рефакторинг схемы (discriminatedUnion fix)

### Проблема
Zod `discriminatedUnion` не поддерживает дублирование discriminator value. Наши схемы:
- `showingExplorationBase.extend({ needsFiltering: false })` — phase: "showing_exploration"
- `showingExplorationBase.extend({ needsFiltering: true })` — phase: "showing_exploration"

Оба имели одинаковый phase → ошибка при запуске.

### Решение
Разбить на отдельные phases:
- `showing_exploration_candidates` — когда показываем кандидатов (< 100)
- `showing_exploration_facets` — когда показываем фасеты (>= 100)
- `asking_after_validate_candidates` — аналогично
- `asking_after_validate_facets` — аналогично

### Что обновлено

1. **schemas.ts**
   - `showingExplorationCandidatesSchema` (export + JSDoc)
   - `showingExplorationFacetsSchema` (export + JSDoc)
   - `askingAfterValidateCandidatesSchema` (export + JSDoc)
   - `askingAfterValidateFacetsSchema` (export + JSDoc)
   - `searchGraphResponseSchema` использует все 4 схемы

2. **state.ts**
   - PHASE enum: 4 новых значения вместо 2
   - NODE — без изменений (один show_exploration, один ask_after_validate)

3. **Ноды**
   - `explore.ts`: устанавливает `PHASE.showing_exploration_candidates/facets`
   - `validate-goal.ts`: устанавливает `PHASE.asking_after_validate_candidates/facets`
   - `show-exploration.ts`: не меняет phase (уже установлен в explore)
   - `ask-after-validate.ts`: не меняет phase (уже установлен в validate-goal)

4. **response-builders.ts** — 4 builder'а вместо 2 с conditional

5. **search-router.ts**
   - PARSE_INTENT_ROUTE_MAPS — 4 записи вместо 2
   - createIntentRoutes — общие routes вынесены в переменные
   - PARSE_INTENT_ALL_DESTINATIONS — все 4 фазы

6. **prompts.ts (NLP)** — описания для всех 4 фаз

7. **prompts.ts (search-graph)** — PHASE_CONTEXT для 4 фаз

8. **Тесты** — заменили PHASE.showing_exploration → showing_exploration_candidates

### Принцип

- **PHASE** — определяет response schema (4 варианта)
- **NODE** — определяет execution unit (2 варианта, как было)
- Бизнес-нода (`explore`, `validate_goal`) устанавливает phase
- Interrupt-нода (`show_exploration`, `ask_after_validate`) не меняет phase

### tsc + lint
✅ Прошли без ошибок

---

## Фаза 3: Добавление недостающих типов в shared/schemas.ts

### Проблема
После checkout для отката неудачного рефакторинга схем, shared/schemas.ts вернулось к старой версии, но facade код уже использовал новые типы.

### Что сделано

1. **Добавлены facet типы в shared/schemas.ts**
   - `FacetField = keyof Pick<UserContext, "countryCode" | "position" | "role" | "industry">`
   - `FacetValue = { value: string, count: number }`
   - `CandidateFacets = { totalCount, countries, positions, roles, industries }`

2. **Добавлено поле `order` в `dictionaryEntrySchema`**
   - `order: z.number().int().min(1).nullable()` — для сортировки позиций

3. **Обновлены phases в searchGraphResponseSchema**
   - `showing_exploration` → `showing_exploration_candidates` + `showing_exploration_facets`
   - `asking_after_validate` → `asking_after_validate_candidates` + `asking_after_validate_facets`
   - Добавлены `chartUrl` и `facets` поля в соответствующие схемы

4. **Добавлен метод `getPositionOrder()` в DictionariesService**
   - Возвращает `string[]` позиций, отсортированных по `order`

5. **Обновлены NLP prompts**
   - Заменены старые phase names на новые (candidates/facets)
   - Без примеров, только семантика

### tsc + lint
✅ Прошли (2 warnings — non-null assertions в response-builders)

---

## Рефлексия (сквозная)

### Как делать правильно

1. **Бизнес-логика в нодах, не в response-builders** — нода вычисляет и записывает в state, response-builder только читает
2. **Производные флаги не хранить** — `needsFiltering` можно вывести из `facets !== null`
3. **Использовать паттерн из load-context.ts** — нода решает на основе условия, записывает результат в state
4. **Union типы для кандидатов** — `CandidateWithContext = A | B` вместо дублирования функций
5. **FacetField через Pick** — `keyof Pick<UserContext, ...>` вместо hardcoded строк
6. **shared = контракт между пакетами** — ConverseResponse, SearchGraphResponse должны быть в shared, не в facade
7. **Перед checkout читать файлы** — чтобы не откатить правки из других сессий

### Как делать неправильно

1. **Chart в validate-goal.ts для adhoc** — adhoc flow это `explore`, не `validate_goal`
2. **Логика в response-builders** — это только маппинг state → response
3. **Telegram зависит от facade** — нарушение архитектуры, всё общение через shared
4. **Выносить graph schemas из shared в facade** — это ломает контракт между пакетами
5. **Использовать sed** — есть filesystem MCP
6. **git checkout без проверки** — можно откатить нужные правки

### Инсайты

1. **discriminatedUnion требует уникальные discriminator values** — нельзя иметь два варианта с одинаковым phase
2. **PHASE vs NODE** — PHASE определяет response schema, NODE определяет execution unit
3. **Архитектура зависимостей: shared ← facade, shared ← telegram-bot** — facade и telegram-bot не должны зависеть друг от друга
4. **NLP промпты без примеров** — только семантика, LLM ограничивается примерами

### Наставления от пользователя

1. **"стопе! мы отображаем кандидатов adhoc режима! а не by_target!"** — понял что chart для adhoc
2. **"needsFiltering разве нужен?"** — производные значения не хранить в state
3. **"телеграм не должен зависеть от фасада!!"** — shared = контракт
4. **"FacetField брался из типа со всеми полями user контекста"** — Pick/Omit вместо hardcode
5. **"никогда не использовать sed!"** — есть filesystem MCP
6. **"перед checkout перечитать файлы"** — не откатывать правки других сессий
7. **"не нужны гвозди и точные примеры! только семантика!"** — NLP промпты

---

## Что делать дальше

1. **Пересобрать facade**: `npm run facade:rebuild`
2. **Ручное тестирование**: `npx tsx poc/mcp-chat.ts --reset && npx tsx poc/mcp-chat.ts "я backend разработчик"`
3. **Проверить chart генерацию** — должен показать chart или facets в зависимости от кол-ва результатов
4. **Locale** — сейчас захардкожен `"ru"`, вынести в config или state

---

## Фаза 4: NLP промпты для facets + citizenships

### Что сделано

1. **Исправлена ошибка с `dictionaryEntrySchema.order`**
   - Было: `.nullable()` — требовало явный `null`
   - Стало: `.optional()` — принимает `undefined` (когда поле отсутствует в JSON)
   - **Убрано ESLint правило `no-optional`** — не все поля должны быть nullable

2. **Обновлены NLP промпты для facets**
   - `showing_exploration_facets`: добавлено объяснение "слишком много результатов, нужно фильтровать чтобы увидеть траектории"
   - `asking_after_validate_facets`: аналогично для pathfinders
   - Формат вывода: `value (count)` для каждого значения
   - Добавлены все категории: Countries, Citizenships, Positions, Roles, Industries

3. **Добавлены citizenships в facets**
   - `candidateFacetsSchema`: добавлено поле `citizenships: z.array(facetValueSchema)`
   - `computeFacets()`: универсальная функция `countByField` для single values и arrays
   - NLP промпты: citizenships в списке facets

4. **Обновлён промпт `asking_after_validate_candidates`**
   - Семантика: показать людей кто ДОСТИГ цели
   - WHERE FROM: откуда начинали
   - HOW: какие навыки, переходы
   - HOW LONG: сколько шли до цели
   - HAPPY?: фидбек — довольны ли позицией
   - WHERE NOW: где сейчас (остались или ушли дальше)
   - WHEN: как давно достигли

### Артефакты
- `src/shared/schemas.ts` — `order: .optional()`, citizenships в facets
- `src/facade/langGraph/search-graph/facets.ts` — универсальный `countByField`
- `src/facade/services/nlp-formatter/prompts.ts` — обновлённые промпты facets
- `eslint.config.mjs` — убрано правило `.optional()` запрета

### tsc + lint
✅ Прошли (2 warnings — non-null assertions в response-builders)

---

## Рефлексия (сквозная)

### Как делать правильно

1. **Бизнес-логика в нодах, не в response-builders** — нода вычисляет и записывает в state, response-builder только читает
2. **Производные флаги не хранить** — `needsFiltering` можно вывести из `facets !== null`
3. **Использовать паттерн из load-context.ts** — нода решает на основе условия, записывает результат в state
4. **Union типы для кандидатов** — `CandidateWithContext = A | B` вместо дублирования функций
5. **FacetField через Pick** — `keyof Pick<UserContext, ...>` вместо hardcoded строк
6. **shared = контракт между пакетами** — ConverseResponse, SearchGraphResponse должны быть в shared, не в facade
7. **Перед checkout читать файлы** — чтобы не откатить правки из других сессий
8. **Универсальные функции** — `countByField` обрабатывает и single values, и arrays
9. **NLP промпты с контекстом** — объяснить ПОЧЕМУ показываем facets, не просто "вот facets"

### Как делать неправильно

1. **Chart в validate-goal.ts для adhoc** — adhoc flow это `explore`, не `validate_goal`
2. **Логика в response-builders** — это только маппинг state → response
3. **Telegram зависит от facade** — нарушение архитектуры, всё общение через shared
4. **Выносить graph schemas из shared в facade** — это ломает контракт между пакетами
5. **Использовать sed** — есть filesystem MCP
6. **git checkout без проверки** — можно откатить нужные правки
7. **Дублировать функции для разных типов полей** — лучше сделать универсальную
8. **Забывать категории в facets промптах** — Roles был пропущен

### Инсайты

1. **discriminatedUnion требует уникальные discriminator values** — нельзя иметь два варианта с одинаковым phase
2. **PHASE vs NODE** — PHASE определяет response schema, NODE определяет execution unit
3. **Архитектура зависимостей: shared ← facade, shared ← telegram-bot** — facade и telegram-bot не должны зависеть друг от друга
4. **NLP промпты без примеров** — только семантика, LLM ограничивается примерами
5. **`.optional()` vs `.nullable()`** — optional для отсутствующих полей (undefined), nullable для явного null
6. **ESLint правила можно убирать** — если правило мешает правильному решению

### Наставления от пользователя

1. **"стопе! мы отображаем кандидатов adhoc режима! а не by_target!"** — понял что chart для adhoc
2. **"needsFiltering разве нужен?"** — производные значения не хранить в state
3. **"телеграм не должен зависеть от фасада!!"** — shared = контракт
4. **"FacetField брался из типа со всеми полями user контекста"** — Pick/Omit вместо hardcode
5. **"никогда не использовать sed!"** — есть filesystem MCP
6. **"перед checkout перечитать файлы"** — не откатывать правки других сессий
7. **"не нужны гвозди и точные примеры! только семантика!"** — NLP промпты
8. **"почему распределения нет?" + "и гражданства?"** — проверять что все данные попадают в ответ
9. **"asking_after_validate_candidates это про by_target — реверс режим"** — понять бизнес-смысл каждой фазы
10. **"а нельзя что ли как то переиспользовать countByField?"** — DRY, универсальные функции
11. **"давай еслинт правило по optional запрету уберем"** — правила должны помогать, не мешать

---

## Что делать дальше

1. **Тестирование facets** — проверить что citizenships и roles показываются в ответе
2. **Chart URL** — протестировать с < 10 кандидатами (временно уменьшить FACETS_MAX_CANDIDATES?)
3. **Locale** — сейчас захардкожен `"ru"`, вынести в config или state
4. **LLM off-script** — если NLP игнорирует инструкции по фазе, усилить промпт

---

## Фаза 5: Анализ ADR-021 (E2E Testing Automation)

### Контекст

Обсудили ADR-021 (LangWatch Scenario + @langchain/mcp-adapters) — автоматизация E2E тестов с симулятором пользователя и LLM-судьёй. Сравнили с текущим manual workflow.

### Сравнение

| Аспект | Manual (сейчас) | + Judge flag | Full ADR |
|--------|-----------------|--------------|----------|
| Setup | 0 | ~60 LOC | ~300 LOC |
| Discovery quality | ✅ Высокий (интуиция) | Medium | Medium |
| Regression prevention | ❌ Нет | ✅ Есть | ✅✅ CI-ready |
| Iteration speed | ✅ Быстро | ✅ Быстро | Медленнее |
| Maintenance | 0 | Низкий | Средний |

### Вывод

**Сейчас автоматизация не нужна.** Причины:
1. Фаза discovery — ищем что работает
2. Промпты меняются часто (каждые 10 мин в сессии)
3. Нет стабильных паттернов для защиты
4. Friction текущего workflow низкий

**Когда понадобится:**
- Стабилизировали 3-4 фазы → regression tests
- Перед production → full ADR для CI
- Когда ломаются уже работающие фазы

**Pareto option (20% → 80%):**
Добавить `--judge` флаг в mcp-chat.ts (~60 LOC) для автоматической проверки NLP по критериям:
```bash
npx tsx poc/mcp-chat.ts "найди похожих" --judge
# ✅ Explains "too many for trajectories"
# ✅ Shows facets: value (count)
# ❌ Missing citizenships
```

**Решение:** Пока не делаем. Automate when it hurts.

---

## Фаза 6: Industries Dictionary + Adhoc Extraction + R2 Config

### Что сделано

1. **Исправлен adhoc extraction prompt**
   - Добавлено поле `industry` в список полей для extraction
   - Промпт: `- industry: BUSINESS sector — map to KNOWN INDUSTRIES`
   - Файл: `src/facade/langGraph/search-graph/prompts.ts`

2. **Создан industries словарь**
   - `database/industries.json` — 14 industries в lowercase
   - `database/import-industries.ts` — импорт скрипт
   - `scripts/import-industries.sh` — shell wrapper
   - Добавлено в `package.json`: `db:prod:init` и `db:test:init`

3. **Исправлены данные Kaggle**
   - `data/kaggle-enriched.json` — industries переведены в lowercase (jq скрипт)
   - Переимпортированы 224 users

4. **Почищены дубликаты Industry nodes**
   - Были: `Healthcare` + `healthcare`, `Telecom` + `telecom`
   - Удалены orphan nodes (lowercase без связей)

5. **Добавлен R2 в docker-compose**
   - `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`
   - Chart generation теперь работает в контейнере

### Результат тестирования

- ✅ Facets показывают citizenships, roles, industries
- ✅ Industry filtering работает (healthcare → 33 candidates)
- ✅ Chart URL генерируется для < 10 candidates
- ⚠️ Chart показывает только точку "Вы" без candidates — нужно исправить

### Артефакты
- `database/industries.json` — словарь industries
- `database/import-industries.ts` — импорт скрипт
- `scripts/import-industries.sh` — shell wrapper
- `docker-compose.yml` — R2 env vars
- `src/facade/langGraph/search-graph/prompts.ts` — industry в adhoc extraction

---

## Рефлексия (сквозная)

### Как делать правильно

1. **Бизнес-логика в нодах, не в response-builders** — нода вычисляет и записывает в state, response-builder только читает
2. **Производные флаги не хранить** — `needsFiltering` можно вывести из `facets !== null`
3. **Использовать паттерн из load-context.ts** — нода решает на основе условия, записывает результат в state
4. **Union типы для кандидатов** — `CandidateWithContext = A | B` вместо дублирования функций
5. **FacetField через Pick** — `keyof Pick<UserContext, ...>` вместо hardcoded строк
6. **shared = контракт между пакетами** — ConverseResponse, SearchGraphResponse должны быть в shared, не в facade
7. **Перед checkout читать файлы** — чтобы не откатить правки из других сессий
8. **Универсальные функции** — `countByField` обрабатывает и single values, и arrays
9. **NLP промпты с контекстом** — объяснить ПОЧЕМУ показываем facets, не просто "вот facets"
10. **Dictionary values в lowercase** — консистентность для поиска (case-sensitive matching)
11. **Фиксить данные у источника** — лучше пофиксить JSON чем добавлять `.toLowerCase()` в import скрипт
12. **Проверять env vars в контейнере** — `docker exec waymates-facade-test env | grep R2`

### Как делать неправильно

1. **Chart в validate-goal.ts для adhoc** — adhoc flow это `explore`, не `validate_goal`
2. **Логика в response-builders** — это только маппинг state → response
3. **Telegram зависит от facade** — нарушение архитектуры, всё общение через shared
4. **Выносить graph schemas из shared в facade** — это ломает контракт между пакетами
5. **Использовать sed** — есть filesystem MCP
6. **git checkout без проверки** — можно откатить нужные правки
7. **Дублировать функции для разных типов полей** — лучше сделать универсальную
8. **Забывать категории в facets промптах** — Roles был пропущен
9. **Mixed case в словарях** — приводит к дубликатам (`Healthcare` vs `healthcare`)
10. **Забывать прокидывать env vars** — R2 не работал потому что не был в docker-compose

### Инсайты

1. **discriminatedUnion требует уникальные discriminator values** — нельзя иметь два варианта с одинаковым phase
2. **PHASE vs NODE** — PHASE определяет response schema, NODE определяет execution unit
3. **Архитектура зависимостей: shared ← facade, shared ← telegram-bot** — facade и telegram-bot не должны зависеть друг от друга
4. **NLP промпты без примеров** — только семантика, LLM ограничивается примерами
5. **`.optional()` vs `.nullable()`** — optional для отсутствующих полей (undefined), nullable для явного null
6. **ESLint правила можно убирать** — если правило мешает правильному решению
7. **Dictionary lookup case-sensitive** — `dict.get(value.toLowerCase())` возвращает entry с original case
8. **jq для batch JSON transformation** — `jq '[.[] | .contexts = [.contexts[] | .industry = (.industry | ascii_downcase)]]'`

### Наставления от пользователя

1. **"стопе! мы отображаем кандидатов adhoc режима! а не by_target!"** — понял что chart для adhoc
2. **"needsFiltering разве нужен?"** — производные значения не хранить в state
3. **"телеграм не должен зависеть от фасада!!"** — shared = контракт
4. **"FacetField брался из типа со всеми полями user контекста"** — Pick/Omit вместо hardcode
5. **"никогда не использовать sed!"** — есть filesystem MCP
6. **"перед checkout перечитать файлы"** — не откатывать правки других сессий
7. **"не нужны гвозди и точные примеры! только семантика!"** — NLP промпты
8. **"почему распределения нет?" + "и гражданства?"** — проверять что все данные попадают в ответ
9. **"asking_after_validate_candidates это про by_target — реверс режим"** — понять бизнес-смысл каждой фазы
10. **"а нельзя что ли как то переиспользовать countByField?"** — DRY, универсальные функции
11. **"давай еслинт правило по optional запрету уберем"** — правила должны помогать, не мешать
12. **"давай заведем industries.json"** — словари должны быть явными, не создаваться динамически
13. **"давай сам JSON скриптом переведем в lowercase"** — фиксить данные у источника

---

## Что делать дальше

1. **Locale** — вынести из hardcode `"ru"` в `explore.ts:59`
2. **Chart для candidates-only** — сейчас показывает только точку "Вы", нужно показать траектории кандидатов

---

## Фаза 7: Архитектурное открытие — Search Modes Refactoring

### Контекст проблемы

При исследовании почему chart показывает только точку "Вы" без траекторий кандидатов, обнаружили глубокую архитектурную проблему:

1. **candidates-only chart бессмысленен** — adhoc search возвращает кандидатов БЕЗ `path`, только `matchedContext`
2. **filterByCurrentContext флаг некорректен** — `searchAdhoc` использует `false` (все контексты), но должен `true` (только текущий)
3. **Pathfinder логика в searchByCurrent мёртвый код** — matchedContext не может одновременно совпадать с нашим текущим И с нашей целью

### Архитектурное решение — 3 режима поиска

| Режим | Кого ищем | Recency на | Chart |
|-------|-----------|------------|-------|
| **searchWaymates** | Однопутники (тот же текущий контекст, та же цель) | текущий контекст | ❌ нет path |
| **searchPathfinders** | Кто прошёл от нашего текущего к нашей цели | целевой контекст | ✅ есть path |
| **reverseSearchPathfinders** | Кто достиг цели (откуда угодно) | целевой контекст | ✅ есть path |

### Ключевые инсайты

1. **Waymates vs Pathfinders — разные алгоритмы:**
   - Waymates: однопутники с recency на текущий контекст
   - Pathfinders: прошли наш путь с recency на целевой контекст

2. **Pathfinder требует двойной матч:**
   - Match 1: кандидат имел наш текущий контекст (в прошлом, без recency)
   - Match 2: кандидат имеет нашу цель (недавно, с recency)
   - Temporal order: цель ПОСЛЕ текущего

3. **Chart имеет смысл только для:**
   - Pathfinders — есть путь от нашего контекста к цели
   - ReversePathfinders — есть путь к цели
   - **НЕ для Waymates** — только текущий контекст, нет траектории

### Оценка рефакторинга

| Режим | LOC | Файлов | Сложность |
|-------|-----|--------|-----------|
| reverseSearchPathfinders (rename) | ~40 | 5 | Rename only |
| searchWaymates (refactor) | ~95 | 6 | Убрать мёртвый код |
| searchPathfinders (NEW) | ~185 | 5 | Новый Cypher с двойным матчем |
| **ВСЕГО** | **~320** | **~8** | |

### Что нужно откатить

**НЕ НУЖНО откатывать:**
- Фазы 1-6 — это рабочий код (facets, industries, R2)
- Chart integration в explore.ts — просто не будет вызываться для waymates

**Нужно сделать (новая задача):**
1. Создать FEAT-046 "Search Modes Refactoring"
2. Реализовать 3 режима поиска
3. Chart оставить только для pathfinders/reversePathfinders

### Состояние для коммита

**Можно закоммитить текущее состояние:**
- Фаза 1-6 полностью рабочая
- Chart URL генерируется (хоть и без траекторий)
- Facets работают
- Industries словарь добавлен
- R2 config в docker-compose

**Известные ограничения (документировать в коммите):**
- Chart для candidates-only показывает только "Вы" — требует FEAT-046
- Locale захардкожен "ru"

---

## Рефлексия (сквозная, финал)

### Как делать правильно

1. **Бизнес-логика в нодах, не в response-builders** — нода вычисляет и записывает в state
2. **Производные флаги не хранить** — вычислять из данных
3. **Union типы для кандидатов** — `CandidateWithContext = A | B`
4. **Dictionary values в lowercase** — консистентность
5. **Проверять env vars в контейнере** — `docker exec ... env`
6. **Глубоко разбираться в бизнес-логике** — понять ЗО каждого компонента перед правками
7. **Искать архитектурные проблемы** — не фиксить симптомы, а причины

### Как делать неправильно

1. **Фиксить chart без понимания откуда данные** — chart не виноват, виноват search
2. **Добавлять path enrichment в adhoc** — это меняет архитектуру, нужен отдельный режим
3. **Игнорировать мёртвый код** — pathfinder логика в searchByCurrent = dead code

### Инсайты этой сессии

1. **3 режима поиска** — waymates/pathfinders/reversePathfinders — разные алгоритмы
2. **Recency семантика** — применяется к разным контекстам в разных режимах
3. **Chart требует path** — без траектории бессмысленен
4. **filterByCurrentContext** — критичный флаг, неправильное значение ломает бизнес-логику
5. **Глубокий анализ окупается** — лучше понять проблему, чем фиксить симптомы

### Наставления от пользователя (новые)

1. **"adhoc планировался как упрощённая версия searchByUser"** — без траектории, без DTW, всё остальное одинаково
2. **"pathfinder и waymates должны считаться РАЗНЫМИ алгоритмами"** — разное применение recency
3. **"searchByTarget переименовывается в fromTarget, реализация не меняется"** — только нейминг
4. **"я за бизнесовое название searchWayMates, searchPathfinders, reverseSearchPathfinders"** — понятный нейминг

---

## Промпт для продолжения после rewind

```
Изучи: sessions/2025-12-25-feat-045-candidates-only-chart.md

КОНТЕКСТ:
- Фазы 1-6 завершены: facets, industries, R2, chart URL работает
- Фаза 7: обнаружена архитектурная проблема с search modes

СОСТОЯНИЕ КОДА:
- Код рабочий, можно коммитить как есть
- Chart показывает только "Вы" — это известное ограничение
- Locale захардкожен "ru"

ЧТО ДЕЛАТЬ:
1. Закоммитить текущее состояние с пометкой об ограничениях
2. Создать FEAT-046 "Search Modes Refactoring" (см. Фаза 7)
3. Реализовать 3 режима: searchWaymates, searchPathfinders, reverseSearchPathfinders

КЛЮЧЕВОЕ РЕШЕНИЕ:
- Waymates: recency на текущий, НЕТ chart
- Pathfinders: recency на цель, ЕСТЬ chart
- ReversePathfinders: recency на цель, ЕСТЬ chart

Объём: ~320 LOC, ~8 файлов
```
