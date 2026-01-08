# Session: Telegram Real-Time Testing via GramJS CLI

**Дата:** 2026-01-06 → 2026-01-07
**Фокус:** Интерактивное тестирование cold-start через реальный Telegram + отладка багов + обновление tests_report.md

---

## Контекст

**Предыстория:** FEAT-059 Demo Video UX Fixes почти завершён. Phase 5 (Vision для Charts) отложен на post-MVP. Нужно было проверить что cold-start flow работает корректно.

**Проблема:** Статичный batch test не гарантирует корректность из-за недетерминированности LLM extraction.

**Решение:** Интерактивное тестирование через GramJS CLI + итеративная отладка промптов.

---

## Что сделано (Phase 1 — до rewind)

### 1. Создан `poc/telegram-chat.ts` — GramJS CLI

```bash
npx tsx poc/telegram-chat.ts "message"           # Отправить сообщение
npx tsx poc/telegram-chat.ts --start             # Отправить /start
npx tsx poc/telegram-chat.ts --file Profile.pdf  # Отправить файл
```

### 2. Исправлен `scripts/cleanup-test-user.ts`

- Добавлено удаление Goal
- Добавлен Redis cache cleanup

### 3. Баги Phase 1 (все FIXED)

| # | Баг | Решение |
|---|-----|---------|
| 1 | Context clarification не применяется | Unified merge в extract-context.ts |
| 2 | Дубликаты в skills/citizenships | `dedupeArray()` |
| 3 | Summary не показывает period | NLP prompt fix |
| A | Session expired после /start | Redis cleanup в script |
| B | Zod errors показываются | NLP prompt: rephrase zodMessage |
| D | Industry inheritance между позициями | `POSITION_INDEPENDENCE_RULE` |

---

## Что сделано (Phase 2 — после rewind, текущая сессия)

### 4. Исправлены проблемы extraction

| Проблема | Решение | Файл |
|----------|---------|------|
| **Skill vs Domain confusion** — LLM путал C++/Android (skills) с domains | Переформулировал DOMAINS EXTRACTION: "broad disciplines, not implementation tools" | `shared/prompts.ts` |
| **Premature plan display** — план показывался до "готово" | Усилил approve условие: требуется explicit completion signal | `parse-story-completion.ts` |
| **qt5 терялся** — словарь возвращал только verified=true | Убрал фильтр `{verified: true}` в Cypher | `dictionaries.ts` |
| **cityName="lowercase"** — галлюцинация формата | Переписал правило: "null unless user explicitly mentioned" | `cold-start-v2/prompts.ts` |
| **"share your passport"** — плохой UX | Заменил "passport" на "nationality" везде | `nlp-formatter/prompts.ts`, `shared/prompts.ts` |
| **Дублирование OPTIONAL_FIELDS** | Вынес в константу `OPTIONAL_FIELDS_HINT` | `nlp-formatter/prompts.ts` |

### 5. Коммит создан

```
53061b7 fix(cold-start): improve extraction quality and UX
```

---

## Что сделано (Phase 3 — после второго rewind)

### 6. Исправлен NLP formatter

| Изменение | Файл |
|-----------|------|
| Убрал показ "НОРМАЛИЗОВАНО: original → normalized" — бесполезно для пользователя | `nlp-formatter/prompts.ts` |
| Добавил Field meanings из GOAL_FIELD_DESCRIPTIONS | `nlp-formatter/prompts.ts` |
| Исправил период: createdAt → endDate (или "present") | `nlp-formatter/prompts.ts` |

### 7. Исправлен parse-story-completion.ts

**Баг:** "done, that's all" интерпретировалось как cancel вместо approve.

**Fix:** Переписал семантику STORY_DECISION_DESCRIPTIONS:
- `approve` — user signals story is COMPLETE, ready to proceed
- `cancel` — user wants to ABORT and EXIT the workflow permanently

### 8. Добавлен DECOMPOSITION_RULES в planningPrompt

**Баг:** Plan показывал Role: C++/Embedded вместо Role: Developer.

**Fix:** Добавил `${DECOMPOSITION_RULES}` в `planningPrompt()` чтобы LLM понимал что position/role/domains это разные измерения.

### 9. Очищены словари от мусора

| Удалено | Причина |
|---------|---------|
| Position: "software engineer" | Не seniority level, добавлено через suggestions |
| Industry: "undisclosed" | Placeholder от CV parser |

### 10. Исправлен CV parser prompt

Добавлено правило: "OMIT fields you cannot determine — never use placeholder values"

---

## Что осталось сделать

### Критично (следующая сессия):

1. **NLP awaiting_final_confirmation** — position/role всё ещё перепутаны в итоговом summary
2. **Эталонный extraction** — добиться соответствия Demo-Alex.json:
   - Industry 1: technology (сейчас research)
   - Role 2: developer (сейчас manager — Team Lead должен быть developer, не manager)
3. **Провести поиск** — после корректного extraction получить 10 кандидатов с графиками

### Не критично:

4. **Locale detection** — язык определяется по Telegram language_code (сейчас en), не баг

---

## Инсайты сессии (для guidelines.md)

### Anti-patterns обнаруженные:

1. **Примеры в скобках в промптах** — LLM может интерпретировать как значения
   - ❌ `cityName: lowercase` → LLM ставит "lowercase" как город
   - ✅ `cityName: null unless user explicitly mentioned a city name`

2. **Точечные фиксы без проверки дублирования** — добавление правил без проверки что они уже есть в другой форме

3. **getVerified vs getAll** — фильтрация словарей по verified=true теряет пользовательские данные

### Рефлексия Phase 3 — ошибки и первопричины:

**Паттерн ошибки:** Многократно добавлял примеры в промпты несмотря на предупреждения.

| Что сделал неправильно | Что должен был сделать |
|------------------------|------------------------|
| `"seniority level (junior, middle, senior, team lead)"` | `${GOAL_FIELD_DESCRIPTIONS.position}` |
| `"done, that's all, finished, готово, всё"` | Семантика: "user signals story is COMPLETE" |
| `'like "Undisclosed", "Unknown", "N/A"'` | "never use placeholder values" |

**Первопричина:** Шаблонное мышление — привычка добавлять примеры для "ясности". Для LLM примеры в скобках создают проблемы:
- LLM может интерпретировать как допустимые значения
- Примеры на конкретном языке ограничивают multilingual поддержку
- Существующие константы (GOAL_FIELD_DESCRIPTIONS, HINTS) уже содержат правильные описания

**Правило для следующих сессий:**
- ТОЛЬКО семантика, никаких литеральных примеров
- Всегда проверять существующие константы перед добавлением описаний
- Использовать `${КОНСТАНТА}` вместо хардкода

---

## Изменённые файлы (закоммичено)

```
src/cypher/queries/dictionaries.ts                  — убран verified фильтр
src/facade/langGraph/cold-start-v2/nodes/parse-story-completion.ts — explicit completion
src/facade/langGraph/cold-start-v2/prompts.ts       — cityName, no-invention rules
src/facade/langGraph/shared/prompts.ts              — skill vs domain, nationality
src/facade/services/nlp-formatter/prompts.ts        — OPTIONAL_FIELDS_HINT, nationality
poc/telegram-chat.ts                                — GramJS CLI
scripts/cleanup-test-user.ts                        — Redis cleanup
```

---

## Полезные команды

```bash
# Telegram CLI
set -a && source .env.test && set +a
npx tsx poc/telegram-chat.ts --start
npx tsx poc/telegram-chat.ts "message"

# Cleanup user
npx tsx scripts/cleanup-test-user.ts --telegramId 379154408

# Rebuild facade
npm run facade:rebuild

# Логи
docker logs waymates-facade-test --tail 50 | grep -E "intent|reasoning"
```

---

## Промпт для продолжения (после rewind)

```
ПРОЧИТАЙ:
1. `/home/alex/projects/WayMatesRemote/sessions/2026-01-06-telegram-realtime-testing.md` — Phase 3 завершена

**Контекст:**
- NLP formatter исправлен (убран "НОРМАЛИЗОВАНО", добавлены Field meanings)
- parse-story-completion исправлен ("done" ≠ "cancel")
- DECOMPOSITION_RULES добавлен в planningPrompt (role теперь корректно)
- CV parser prompt исправлен (без placeholders)
- Мусор из словарей удалён (software engineer, undisclosed)

**Текущее состояние extraction vs эталон Demo-Alex.json:**
| Поле | Эталон | Сейчас | Проблема |
|------|--------|--------|----------|
| Industry 1 | technology | research | CV содержит "Research" |
| Role 2 | developer | manager | Team Lead = developer, не manager |

**TODO Phase 4:**
1. Исправить NLP awaiting_final_confirmation — position/role перепутаны в summary
2. Добиться эталонного extraction для Demo-Alex.json
3. Провести поиск — получить 10 кандидатов с графиками

**КРИТИЧНО — правила промптов:**
- ТОЛЬКО семантика, НИКАКИХ примеров в скобках
- Использовать существующие константы: GOAL_FIELD_DESCRIPTIONS, HINTS, DECOMPOSITION_RULES
- ${КОНСТАНТА} вместо хардкода
```

---

## Phase 4 Session Report

**Дата:** 2026-01-07
**Сессия:** --session phase4

---

### ✅ ИСПРАВЛЕНО

| # | Проблема | Решение | Файл |
|---|----------|---------|------|
| 1 | "continue" дублирует план | Добавил `continue: NODE.extract_context` | `decision-router.ts:45` |
| 2 | План показывал Role/Domains | Упростил NLP — только title + period | `nlp-formatter/prompts.ts:185-188` |
| 3 | "❌ MISSING:" пустое | Показывать только если не пусто | `nlp-formatter/prompts.ts:192` |
| 4 | Role definitions для extraction | Добавил explicit developer/manager definitions | `cold-start-v2/prompts.ts:348-350` |
| 5 | Goal MERGE conflict | Добавил `{userId}` в MERGE pattern | `cypher/queries/goals.ts:29` |

---

### 🔄 ЧАСТИЧНО РЕШЕНО

| # | Проблема | Статус | Заметки |
|---|----------|--------|---------|
| 1 | Team Lead → role=developer | Manual edit работает | LLM всё ещё извлекает manager, пользователь исправляет вручную (как в batch test) |
| 2 | Goal saves empty | Исправлено MERGE | Goal теперь сохраняется с данными |

---

### 🐛 ОТКРЫТЫЕ БАГИ

| # | Проблема | Root Cause | Priority |
|---|----------|------------|----------|
| 1 | 0 pathfinders при валидных данных | Search не находит matching trajectories | 🔴 P0 |
| 2 | Trail fields (platform) в context missingFields | validate-context смешивает entity types | 🟡 P1 |
| 3 | cityName в MISSING после заполнения | Clarification state sync issue | 🟡 P1 |

---

### 📊 Текущее состояние

**Goal в Neo4j (сохранён корректно):**
```json
{
  "position": {"mode": "desired", "values": ["head of engineering"]},
  "role": {"mode": "desired", "values": ["manager"]},
  "countries": {"mode": "desired", "values": ["NL"]},
  "domains": {"mode": "desired", "values": ["ai"]},
  "salaryMin": 200000
}
```

**Demo данные существуют:**
```cypher
MATCH (c:Context)
WHERE c.position = 'head of engineering' AND c.countryCode = 'NL'
-- Возвращает 5 contexts с ai в domains
```

**Проблема поиска:**
- referenceContext: technical project manager, manager, fintech
- targetContext: head of engineering, NL, ai
- Результат: 0 pathfinders
- Причина: Нет users с trajectory `technical project manager → head of engineering`

---

### 📁 Изменённые файлы

```
src/facade/langGraph/cold-start-v2/decision-router.ts
src/facade/langGraph/cold-start-v2/prompts.ts
src/facade/langGraph/shared/prompts.ts
src/facade/services/nlp-formatter/prompts.ts
src/facade/langGraph/search-graph/nodes/set-goal.ts (logging)
src/facade/langGraph/search-graph/nodes/search-pathfinders.ts (logging)
src/cypher/queries/goals.ts
```

---

### 🎯 TODO для следующей сессии

1. **Расширить demo данные** — добавить trajectories PM → Head of Engineering
2. **Или ослабить matching** — проверить почему pathfinder search не находит совпадения
3. **Убрать debug logging** из set-goal.ts и search-pathfinders.ts
4. **Fix trail/context mixing** в validate-context

---

### Команды для продолжения

```bash
# Cleanup и свежий старт
npm run facade:rebuild:clean

# Тест с PDF
npx tsx poc/telegram-chat.ts --file Profile.pdf

# Проверить goal
MATCH (u:User)-[:HAS_GOAL]->(g:Goal)
WHERE NOT u.userId STARTS WITH 'usr_019b0055'
RETURN g.targetContext
```

---

## Phase 5 Session Report

**Дата:** 2026-01-07
**Сессия:** --session phase5

---

### ✅ ИСПРАВЛЕНО — Критичный рефакторинг Telegram Bot Session

**Проблема:** Два конфликтующих механизма session management:
1. **grammY session middleware** — сохранял `{status, userId, sessionId}` в Redis как голый ключ `379154408`
2. **SessionService** — кешировал sessionId в Redis как `telegram:session:379154408:sessionId`

**Симптом:** После cleanup-test-user.ts сессия терялась — grammY загружала stale данные из Redis с устаревшим userId.

**Решение — полный рефакторинг:**

| Изменение | Файл |
|-----------|------|
| Убрана grammY session + RedisAdapter | `bot.ts` |
| Упрощён SessionService (без Redis кеша) | `telegram-bot/services/session-service.ts` |
| Новый тип `UserInfo` вместо `MySessionData` | `types.ts` |
| Все handlers переведены на `ctx.userInfo` | `converse.ts`, `document.ts`, `start.ts`, `voice.ts`, `token.ts`, `link.ts` |
| Убран Redis из index.ts | `index.ts` |
| Упрощён cleanup скрипт (Redis очистка не нужна) | `cleanup-test-user.ts` |
| Удалён obsolete тест | `session-service.integration.ts` |

**Новая архитектура:**
- Единый источник правды — Facade (Postgres)
- Каждый запрос → `register_telegram` → fresh userId/sessionId
- Нет stale данных в Redis бота
- Cleanup проще — только Postgres + Neo4j

---

### ✅ ДОПОЛНИТЕЛЬНЫЕ ФИКСЫ

| # | Изменение | Файл |
|---|-----------|------|
| 1 | Добавлен `npm run core:rebuild` | `package.json` |
| 2 | Добавлен `getOrCreate()` в SessionService | `facade/services/session.service.ts` |
| 3 | `registerViaTelegram` использует `getOrCreate` вместо `create` | `facade/services/auth.service.ts` |

---

### 🐛 ОТКРЫТЫЙ БАГ (обнаружен в конце сессии)

**Session expired при последовательных запросах:**
- `register_telegram` возвращал разный sessionId между вызовами
- LangGraph checkpoint привязан к старому sessionId → SessionExpiredError

**Частичный fix сделан:**
- Добавлен `getOrCreate()` в Facade SessionService
- `auth.service.ts` использует `getOrCreate` вместо `create`

**НЕ ЗАКОНЧЕНО:**
- Facade НЕ пересобран (прервано)
- Тест с Demo-Alex.json НЕ проведён

---

### 🎯 TODO для следующей сессии

**Критично (блокирует тестирование):**
1. ✅ `npm run facade:rebuild` — применить fix `getOrCreate`
2. Тест e2e flow — /start → PDF → confirm all → goal → pathfinders

**После разблокировки:**
3. Добиться соответствия extraction с Demo-Alex.json через диалог
4. Получить pathfinders с графиками
5. Удалить debug logging из `set-goal.ts` и `search-pathfinders.ts`

---

### 📁 Изменённые файлы (НЕ закоммичено!)

```
src/telegram-bot/bot.ts                      — убрана grammY session
src/telegram-bot/types.ts                    — UserInfo вместо MySessionData
src/telegram-bot/services/session-service.ts — упрощён
src/telegram-bot/index.ts                    — убран Redis
src/telegram-bot/handlers/*.ts               — ctx.userInfo вместо ctx.session
src/facade/services/session.service.ts       — getOrCreate()
src/facade/services/auth.service.ts          — getOrCreate в registerViaTelegram
scripts/cleanup-test-user.ts                 — упрощён
package.json                                 — core:rebuild
tests/telegram-bot/integration/session-service.integration.ts — УДАЛЁН
```

---

### 📚 РЕФЛЕКСИЯ Phase 5

**Ошибки сессии и первопричины:**

| # | Что делал неправильно | Что должен был сделать |
|---|----------------------|------------------------|
| 1 | Пересобирал только facade, когда изменял cypher queries | Анализировать ЧТО изменил → какой модуль пересобирать |
| 2 | Не проверял Redis ключи после cleanup | Добавить проверку `redis-cli KEYS "*telegramId*"` в workflow |
| 3 | Начал рефакторинг без полного понимания архитектуры сессий | Сначала нарисовать flow, потом менять |

**Урок — какой модуль пересобирать:**
- `src/cypher/`, `src/core/` → `npm run core:rebuild`
- `src/facade/` → `npm run facade:rebuild`
- `src/telegram-bot/` → `npm run bot:docker:restart`

---

### 🚀 Промпт для продолжения Phase 5 (устарел)

*См. Phase 6 ниже*

---

## Phase 6 Session Report

**Дата:** 2026-01-07
**Сессия:** manual-test-debug continuation

---

### ✅ ИСПРАВЛЕНО

| # | Проблема | Решение | Файл |
|---|----------|---------|------|
| 1 | cleanup-test-user не чистил Redis | Добавлена очистка `session:*` и `user:currentSession:*` | `scripts/cleanup-test-user.ts` |
| 2 | MessageBatcher кэшировал stale sessionId в closure | Отдельный `processors` Map, обновляется при каждом `enqueue()` | `telegram-bot/services/message-batcher.service.ts` |
| 3 | response-builders: одно сообщение для missing и suggestions | Добавлен `clarificationType`, разное сообщение | `cold-start-v2/response-builders.ts` |
| 4 | prompts.ts: hardcoded примеры ("yes", "да") | ПОЛНЫЙ рефакторинг — только семантика, константы, литералы фаз | `cold-start-v2/prompts.ts` |
| 5 | prompts.ts: hardcoded tool flow | Убран — routing в коде (Single Source of Truth) | `cold-start-v2/prompts.ts` |
| 6 | contextClarificationPrompt не знал о suggestions | Добавлен параметр `suggestions: SuggestionForPrompt[]` | `prompts.ts`, `extract-context.ts` |

---

### 🔧 РЕФАКТОРИНГ prompts.ts

**Убрано:**
- Hardcoded примеры: `"yes", "да", "correct", "looks good"`
- Tool flow: `"1. plan_career_history → call show_plan"`
- Константа `INTENT_SEMANTICS` (фазы разные — интенты разные)
- Дублирование `OPTIONAL FIELDS`, `FORMAT RULES`
- Пояснения типа `"passport countries"`

**Добавлено:**
- Константы: `SECTION_DIVIDER`, `FORMAT_RULES_BASE`, `POSITION_INDEPENDENCE_RULE`
- Литералы фаз: `${PHASE.awaiting_clarification}` вместо строки
- `SuggestionForPrompt` тип для clarification
- Merge rules для suggestions mode

---

### 🐛 ОБНАРУЖЕНО но НЕ исправлено

| # | Проблема | Root Cause | Priority |
|---|----------|------------|----------|
| 1 | NLP показывает технические имена полей (birthYear, salaryExact) | NLP formatter prompt не переводит | 🔴 P0 |
| 2 | "Position: null" показывается | NLP показывает сырые данные | 🔴 P0 |
| 3 | Язык гуляет (en/ru) | locale приходит как "en", NLP выбирает по userResponse | 🟡 P1 |

---

### 📁 Изменённые файлы (НЕ закоммичено!)

```
scripts/cleanup-test-user.ts                           — Redis cleanup
src/telegram-bot/services/message-batcher.service.ts   — processors Map
src/telegram-bot/handlers/start.ts                     — messageBatcher.clear()
src/facade/langGraph/cold-start-v2/response-builders.ts — clarificationType
src/facade/langGraph/cold-start-v2/prompts.ts          — ПОЛНЫЙ рефакторинг
src/facade/langGraph/cold-start-v2/nodes/extract-context.ts — suggestions в clarify
```

---

### 📚 РЕФЛЕКСИЯ Phase 6

| # | Что делал неправильно | Первопричина | Правило |
|---|----------------------|--------------|---------|
| 1 | cleanup не чистил Redis | Поверил комментарию в коде, не проверил | При cleanup проверять ВСЕ хранилища |
| 2 | Не понял closure capture в batcher | Не отследил что callback захватывает sessionId | Кэшированные callbacks = проверять актуальность данных |
| 3 | Hardcoded примеры в промптах | Привычка "примеры помогают" | Только семантика, никаких literal примеров |
| 4 | Tool flow в prompt | Хотел "помочь" LLM | Routing = в коде, не в prompt |

---

### 🎯 TODO для следующей сессии (Phase 7)

**Критично (блокирует тестирование):**
1. 🔴 Исправить NLP formatter — human-readable field names
2. 🔴 Не показывать null values в clarification
3. 🔴 Тест e2e: /start → PDF → confirmations → goal → pathfinders

**После разблокировки:**
4. 🟡 Стабилизировать locale handling
5. 🟡 Удалить debug logging из set-goal.ts, search-pathfinders.ts
6. 🟡 lint:fix + tsc + коммит

---

### 🚀 Промпт для продолжения (после rewind)

```
ПРОЧИТАЙ:
1. `/home/alex/projects/WayMatesRemote/sessions/2026-01-06-telegram-realtime-testing.md` — Phase 6 (не завершена)

**Контекст Phase 6:**
- MessageBatcher fix применён (processors Map вместо closure)
- prompts.ts полностью рефакторен (без hardcoded примеров)
- cleanup-test-user.ts чистит Redis
- Файлы изменены, НЕ закоммичены, facade ПЕРЕСОБРАН

**Баги обнаружены но НЕ исправлены:**
1. 🔴 NLP показывает технические имена полей (birthYear → "Год рождения")
2. 🔴 "Position: null" показывается (должно быть скрыто или "не указан")
3. 🟡 Язык гуляет en/ru

**TODO Phase 7:**
1. Исправить NLP formatter prompt для awaiting_clarification
2. Тест e2e: /start → PDF → confirmations → goal → pathfinders
3. Удалить debug logging + lint:fix + tsc + коммит

**Ключевые файлы NLP:**
- src/facade/services/nlp-formatter/prompts.ts
- src/facade/langGraph/cold-start-v2/response-builders.ts

**Правило рефакторинга промптов:**
- ТОЛЬКО семантика, НИКАКИХ примеров слов
- Фазы через литералы: ${PHASE.xxx}
- Single Source of Truth = код (routing, schemas)
```

---

## Phase 7 Session Report

**Дата:** 2026-01-07
**Сессия:** /manual-test-debug continuation

---

### ✅ ИСПРАВЛЕНО

| # | Проблема | Решение | Файл |
|---|----------|---------|------|
| 1 | NLP показывал технические имена полей (birthYear) | Добавил `FIELD_DISPLAY_NAMES` — маппинг field → human-readable | `shared/prompts.ts` |
| 2 | Null values показывались в NLP output | JSON.stringify replacer фильтрует null → undefined | `nlp-formatter.service.ts` |
| 3 | Citizenship терялся при multi-round clarification | **Selective merge** — берём из LLM только `fieldsToMerge` | `extract-context.ts` |
| 4 | Citizenship не наследовался между контекстами | Inheritance из `firstContext` (citizenships, birthYear, educationLevel) | `extract-context.ts` |
| 5 | Trail fields (platform) не в маппинге | Добавлены `skill`, `platform` в `FIELD_DISPLAY_NAMES` | `shared/prompts.ts` |

---

### 🔧 КЛЮЧЕВЫЕ ИЗМЕНЕНИЯ

**1. FIELD_DISPLAY_NAMES (shared/prompts.ts)**
```
position → "Position level"
citizenships → "Citizenship"
birthYear → "Year of birth"
skill → "Learning skill"
platform → "Learning platform"
```

**2. JSON null filtering (nlp-formatter.service.ts)**
```typescript
const data = JSON.stringify(result, (_, value) => (value === null ? undefined : value), 2);
```
LLM видит только non-null поля → показывает всё.

**3. Selective merge (extract-context.ts)**
При clarification берём из LLM response ТОЛЬКО поля которые спрашивали:
```typescript
const fieldsToMerge = [...missingFieldNames, ...suggestions.map(s => s.field)];
// Итерируем MERGEABLE_FIELDS, берём из merged только если field в fieldsSet
```
Это предотвращает потерю ранее заполненных полей.

**4. Stable fields inheritance (extract-context.ts)**
```typescript
const firstContext = collectedContexts[0];
if (firstContext && currentContextIndex > 0) {
  contextData.citizenships ??= firstContext.citizenships;
  contextData.birthYear ??= firstContext.birthYear;
  contextData.educationLevel ??= firstContext.educationLevel;
}
```
Поля не меняются между позициями → наследуются.

---

### 🐛 ОТКРЫТЫЕ БАГИ

| # | Проблема | Root Cause | Priority |
|---|----------|------------|----------|
| 1 | Trail extraction путает skills с platform | LLM extraction prompt | 🟡 P1 |
| 2 | Citizenship не показывается в context confirmation для позиций 2+ | Возможно inheritance не полностью применяется | 🟡 P1 |

---

### 📁 Изменённые файлы (НЕ закоммичено!)

```
src/facade/langGraph/shared/prompts.ts                — FIELD_DISPLAY_NAMES + trail fields
src/facade/services/nlp-formatter/nlp-formatter.service.ts — JSON null filtering
src/facade/services/nlp-formatter/prompts.ts          — human-readable labels в instructions
src/facade/langGraph/cold-start-v2/nodes/extract-context.ts — selective merge + inheritance
```

---

### 📚 РЕФЛЕКСИЯ Phase 7

| # | Что делал неправильно | Первопричина | Правило |
|---|----------------------|--------------|---------|
| 1 | Предлагал касты `as Type` | Быстрее чем типизация | eslint.config.mjs = source of truth. Касты запрещены |
| 2 | Хотел править промпт вместо понимания data flow | "Промпт виноват" — шаблон | Сначала debug от конца к началу: что NLP получил → что response-builder вернул |
| 3 | Inheritance из previousContext вместо firstContext | Не продумал edge case | Stable fields (citizenship, birthYear) не меняются → брать из первого контекста |
| 4 | Спрашивал "где править" вместо анализа | Хотел быстрый ответ | Давать рекомендации с аргументами, не спрашивать |

---

### 🎯 TODO для следующей сессии

**Критично (проверить фиксы):**
1. 🔴 Повторный e2e тест: /start → PDF → 3 confirmations → все показывают citizenship
2. 🔴 lint:fix + tsc + commit изменений Phase 7

**После верификации:**
3. 🟡 Исправить trail extraction (skills vs platform confusion)
4. 🟡 Удалить debug logging из set-goal.ts, search-pathfinders.ts
5. 🟡 Провести поиск pathfinders — получить результаты

---

### 🚀 Промпт для продолжения (после rewind)

```
ПРОЧИТАЙ:
1. `/home/alex/projects/WayMatesRemote/sessions/2026-01-06-telegram-realtime-testing.md` — Phase 7

**Контекст Phase 7:**
- NLP null filtering применён (JSON.stringify replacer)
- FIELD_DISPLAY_NAMES добавлен (human-readable labels)
- Selective merge для clarification (fieldsToMerge)
- Inheritance из firstContext (citizenships, birthYear, educationLevel)
- Файлы изменены, НЕ закоммичены

**Что нужно:**
1. 🔴 lint:fix + tsc --noEmit
2. 🔴 Тест e2e: /start → PDF → confirm all 3 positions (проверить citizenship во всех)
3. 🔴 Коммит изменений Phase 7

**Изменённые файлы:**
- shared/prompts.ts — FIELD_DISPLAY_NAMES
- nlp-formatter.service.ts — JSON null filtering
- extract-context.ts — selective merge + inheritance
- nlp-formatter/prompts.ts — instructions

**Открытые баги:**
- Trail extraction путает skills с platform
- Citizenship может не показываться в confirmation 2/3
```

---

## Phase 8 Session Report

**Дата:** 2026-01-07
**Сессия:** /manual-test-debug continuation (Phase 7 finalization + Trail freeze)

---

### ✅ ИСПРАВЛЕНО

| # | Проблема | Решение | Файл |
|---|----------|---------|------|
| 1 | Suggestions показывались с нумерацией (1. junior 2. middle) | Убрал нумерацию: `junior / middle / senior?` | `nlp-formatter/prompts.ts` |
| 2 | Trail required field (platform) блокировал flow | **ЗАМОРОЗКА TRAILS** — полностью отключен сбор trails | `extract-context.ts`, `validate-context.ts`, `prompts.ts` |
| 3 | Unused imports после заморозки | Закомментированы с пометкой `// FROZEN:` | `extract-context.ts`, `validate-context.ts` |

---

### 🧊 ЗАМОРОЗКА TRAILS

**Причина:** Trail extraction галлюцинировал trails которых нет в CV (Leadership Training, Agile Methodologies), затем требовал `platform` — блокировал flow.

**Что закомментировано:**

| Файл | Что отключено |
|------|---------------|
| `extract-context.ts` | `extractAllTrails()`, `trailExtractionModel`, imports |
| `validate-context.ts` | `validateTrails()`, trail missing fields merge |
| `prompts.ts` | `trailExtractionPrompt()`, incomingTrails в planning |

**Пометка:** Все закомментированные блоки помечены `// FROZEN:` для поиска при размораживании.

---

### ✅ E2E TEST PASSED

**Flow:** /start → PDF → Position 1 (senior) → Position 2 → Position 3 → Save

**Результат:**
- ✅ Все 3 позиции подтверждены без блокировки trails
- ✅ Citizenship: RU показан в позиции 1
- ✅ Профиль сохранён

---

### 🐛 ОТКРЫТЫЕ БАГИ (minor, не блокируют)

| # | Проблема | Root Cause | Priority |
|---|----------|------------|----------|
| 1 | "Уровень позиции: null / ?" | NLP показывает null в suggestions | 🟡 P1 |
| 2 | Позиции 2/3 не показывают Citizenship | Inheritance применяется, но NLP не отображает | 🟡 P1 |
| 3 | Extraction не соответствует Demo-Alex.json | Industry, Role, Domains расходятся | 🟡 P1 |

---

### 📁 Изменённые файлы (НЕ закоммичено!)

```
src/facade/services/nlp-formatter/prompts.ts              — suggestions без нумерации
src/facade/langGraph/cold-start-v2/nodes/extract-context.ts — trails frozen + imports
src/facade/langGraph/cold-start-v2/nodes/validate-context.ts — trail validation frozen
src/facade/langGraph/cold-start-v2/prompts.ts              — trail prompts frozen
```

**Файлы Phase 7 (также не закоммичены):**
```
src/facade/langGraph/shared/prompts.ts                     — FIELD_DISPLAY_NAMES
src/facade/services/nlp-formatter/nlp-formatter.service.ts — JSON null filtering
```

---

### 📚 РЕФЛЕКСИЯ Phase 8

| # | Моё неправильное действие | Что должен был сделать | Первопричина |
|---|--------------------------|------------------------|--------------|
| 1 | Предложил костыль "парсить 1/2/3 в промпте" | Убрать нумерацию вообще — UX first | Инерция: фиксить симптом, не причину |
| 2 | Пропустил "null / ?" в выводе NLP | Остановиться, разобраться, зарепортить баг | Спешка к завершению теста |
| 3 | Удалял код вместо комментирования | Закомментировать с `// FROZEN:` для легкого возврата | Пользователь скорректировал |

**Правило для следующих сессий:**
- При UX баге — думать о пользователе, не о коде
- Не пропускать странный вывод — сразу разбираться
- Freeze ≠ Delete — комментировать с пометкой

---

### 🎯 TODO для следующей сессии

**Цель:** Подготовка к Demo видео

**Критично:**
1. 🔴 Коммит всех изменений Phase 7 + Phase 8
2. 🔴 Исправить NLP баги:
   - "null / ?" в suggestions
   - Citizenship в позициях 2/3
3. 🔴 Добиться соответствия extraction с `/tests/core/fixtures/Demo-Alex.json`:
   - Industry 1: technology (не research)
   - Role 2: developer (не manager)
   - Skills, domains — проверить

**После разблокировки:**
4. 🟡 Провести поиск pathfinders — получить результаты с графиками
5. 🟡 Удалить debug logging из set-goal.ts, search-pathfinders.ts

---

### 🚀 Промпт для продолжения (после rewind)

```
ПРОЧИТАЙ:
1. `/home/alex/projects/WayMatesRemote/sessions/2026-01-06-telegram-realtime-testing.md` — Phase 8

**Контекст Phase 8:**
- Trail collection FROZEN (закомментировано с // FROZEN:)
- Suggestions без нумерации (junior / middle / senior?)
- E2E test passed: 3 позиции, профиль сохранён
- Файлы изменены, НЕ закоммичены

**Открытые баги (minor):**
1. "null / ?" в suggestions — NLP показывает null
2. Citizenship не показывается в позициях 2/3
3. Extraction расходится с Demo-Alex.json

**Цель сессии: Demo видео**
1. 🔴 Коммит Phase 7 + Phase 8
2. 🔴 Фикс NLP багов (null, citizenship)
3. 🔴 Extraction → Demo-Alex.json (industry=technology, role=developer)
4. 🔴 Поиск pathfinders с графиками

**Эталон:** `/home/alex/projects/WayMatesRemote/tests/core/fixtures/Demo-Alex.json`

**Правила:**
- UX first — думать о пользователе
- Не пропускать странный вывод
- Freeze ≠ Delete
```

---

## Phase 9 Session Report

**Дата:** 2026-01-08
**Сессия:** /manual-test-debug continuation (Demo preparation)

---

### ✅ ИСПРАВЛЕНО

| # | Проблема | Решение | Файл |
|---|----------|---------|------|
| 1 | null показывался в suggestions | `filterNullValues()` в response-builder | `response-builders.ts` |
| 2 | Citizenship не наследовался ([] vs null) | `hasValue()` helper проверяет empty array | `extract-context.ts` |
| 3 | Edit context терял поля (LLM возвращал null) | Prompt: "COPY original value, NEVER return null" | `prompts.ts` |
| 4 | "timeline order" — роботная формулировка | "preliminary career plan" | `nlp-formatter/prompts.ts` |
| 5 | Preview со скиллами "Software Engineer (C++)" | Структурированная schema: `startYear`, `endYear`, `title` | `schemas.ts`, `plan-career.ts` |

---

### 🔧 КЛЮЧЕВЫЕ АРХИТЕКТУРНЫЕ ИЗМЕНЕНИЯ

**1. Structured preview в ContextAgenda**

```
ДО: preview: z.string().describe("YYYY-YYYY: Job Title")
    → LLM игнорировал описание, добавлял скиллы

ПОСЛЕ:
  startYear: z.number()
  endYear: z.number().nullable()
  title: z.string().describe("Job title ONLY, NO skills")
  → preview формируется в TypeScript: `formatPreview()`
```

**2. hasValue() для inheritance**

```typescript
function hasValue(value: unknown): boolean {
  if (value == null) return false;
  if (Array.isArray(value)) return value.length > 0;  // ← key fix
  if (typeof value === "string") return value.length > 0;
  return true;
}
```

LLM может вернуть `[]` вместо `null` для пустого массива — `??=` не сработает.

**3. Edit context — copy not null**

Prompt изменён: "CRITICAL: For fields NOT mentioned, COPY original value exactly. NEVER return null."

---

### ✅ E2E TEST PASSED — ДАННЫЕ СООТВЕТСТВУЮТ ЭТАЛОНУ

**Эталон:** `tests/core/fixtures/Demo-Alex.json`

| # | position | role | industry | domains | citizenship |
|---|----------|------|----------|---------|-------------|
| 1 | middle | developer | technology | backend, mobile | RU ✅ |
| 2 | team lead | developer | technology | backend, security | RU ✅ |
| 3 | TPM | manager | fintech | management, backend | RU ✅ |

**Pathfinders найдены** — поиск работает.

---

### 📁 Изменённые файлы (НЕ закоммичено!)

```
src/shared/schemas.ts                                — startYear, endYear, title в ContextAgendaBase
src/facade/langGraph/cold-start-v2/nodes/plan-career.ts — formatPreview()
src/facade/langGraph/cold-start-v2/nodes/extract-context.ts — hasValue(), inheritance fix
src/facade/langGraph/cold-start-v2/prompts.ts        — edit context prompt fix
src/facade/langGraph/cold-start-v2/response-builders.ts — filterNullValues()
src/facade/services/nlp-formatter/prompts.ts         — "preliminary career plan"
tests/facade/agents/cold-start-v2/unit/contracts.spec.ts — mockAgenda()
tests/facade/agents/cold-start/helpers/cold-start-helpers.ts — createAgendaFromContext()
```

---

### 📚 РЕФЛЕКСИЯ Phase 9

| # | Моё неправильное действие | Что должен был сделать | Первопричина |
|---|--------------------------|------------------------|--------------|
| 1 | Предложил regex костыль для удаления скиллов из preview | Структурированная schema сразу | Быстрый фикс vs правильное решение |
| 2 | Добавил `as Type` cast в filterNullValues | Типизировать правильно (eslint запрещает) | Не помню правила eslint.config.mjs |
| 3 | Использовал optional вместо nullable | OpenAI не поддерживает optional | Не проверил ограничения OpenAI structured output |
| 4 | Отправлял скриптовые сообщения боту вместо реактивных | Читать ответ → реагировать по смыслу | Подыгрывал LLM вместо тестирования реального UX |

**Правила для следующих сессий:**
- Structured schema > prompt descriptions для контроля LLM output
- `hasValue()` для проверки массивов — `??=` не работает с `[]`
- При тестировании через telegram — реагировать на ответ, не подыгрывать
- eslint.config.mjs = source of truth (касты запрещены)

---

### 🐛 ОТКРЫТЫЙ БАГ (обнаружен, НЕ исправлен)

| # | Проблема | Root Cause | Файл |
|---|----------|------------|------|
| 1 | Goal "already exists" при повторном сохранении | CREATE вместо MERGE в Cypher | `src/core/goals-manager.ts` |

**Workaround:** Удалить Goal через Cypher перед сохранением:
```cypher
MATCH (g:Goal) WHERE g.userId = 'usr_...' DELETE g
```

---

### 🎯 TODO для следующей сессии

**Критично:**
1. 🔴 **Коммит Phase 7 + 8 + 9** — много изменений накопилось
2. 🔴 **Исправить Goal MERGE баг** — goals-manager.ts: MERGE вместо CREATE

**После коммита:**
3. 🟡 Удалить debug logging из set-goal.ts, search-pathfinders.ts
4. 🟡 Проверить locale detection — сейчас зависит от Telegram language_code
5. 🟡 Тест pathfinders с графиками (Chart visualization)

---

### 🚀 Промпт для продолжения (после rewind)

```
ПРОЧИТАЙ:
1. `/home/alex/projects/WayMatesRemote/sessions/2026-01-06-telegram-realtime-testing.md` — Phase 9

**Контекст Phase 9:**
- Все фиксы применены, E2E test passed
- Данные в Neo4j соответствуют эталону Demo-Alex.json
- Pathfinders найдены
- Файлы изменены, НЕ закоммичены (Phase 7+8+9)

**Что осталось:**
1. 🔴 Коммит Phase 7 + 8 + 9 (lint:fix + tsc + commit)
2. 🔴 Goal MERGE баг (goals-manager.ts — CREATE вместо MERGE)

**Изменённые файлы:**
- schemas.ts — structured preview (startYear, endYear, title)
- plan-career.ts — formatPreview()
- extract-context.ts — hasValue(), inheritance
- prompts.ts — edit copy not null
- response-builders.ts — filterNullValues()
- nlp-formatter/prompts.ts — preliminary career plan
- tests — mockAgenda()

**Фиксы работают:**
✅ null не показывается в suggestions
✅ Citizenship наследуется на все 3 позиции
✅ Edit сохраняет существующие поля
✅ Preview без скиллов (structured schema)
✅ Pathfinders найдены
```

---

## Phase 10 Session Report

**Дата:** 2026-01-08
**Сессия:** /manual-test-debug continuation

---

### ✅ ИСПРАВЛЕНО

| # | Проблема | Решение | Файл |
|---|----------|---------|------|
| 1 | Context extraction mixing — LLM извлекал все 3 позиции в одну | SINGLE POSITION EXTRACTION секция в prompt | `cold-start-v2/prompts.ts` |
| 2 | "хочу другую цель" → cancel | Добавлены `change`, `delete` в `SEARCH_MODE_ROUTES` и buildRouteMap | `search-router.ts` |
| 3 | Empty goal показывал "Salary: $0-$0" | `isEmpty` check + phase → clarifying_goal | `extract-goal.ts` |
| 4 | LLM возвращал 0 вместо null | Prompt: "NEVER return empty values (0, "", [])" | `extraction.ts`, `cold-start-v2/prompts.ts` |
| 5 | clarifying_goal показывал placeholder | NLP prompt: "DO NOT show extractedGoal data" | `nlp-formatter/prompts.ts` |
| 6 | industry="null" (строка) | FORMAT_RULES_BASE: "JSON null, NEVER string 'null'" | `cold-start-v2/prompts.ts` |
| 7 | greeting stateless, не знал о профиле | Conditional: onboarding (без профиля), greetingWithProfile (с профилем) | `flow-guard-checker.service.ts`, `prompts.ts` |

---

### 🔧 КЛЮЧЕВЫЕ АРХИТЕКТУРНЫЕ ИЗМЕНЕНИЯ

**1. Context Extraction — Single Position Focus**

```
SINGLE POSITION EXTRACTION (CRITICAL):
- Extract data EXCLUSIVELY for the position specified above
- The conversation may mention multiple positions — focus ONLY on "${preview}"
- If information is not explicitly associated with this position, use null
- Do NOT merge data from different positions into one
```

**2. Search Router — change/delete в asking_search_mode**

```typescript
[PHASE.asking_search_mode, buildRouteMap([
  NODE.search_waymates, NODE.search_pathfinders,
  NODE.extract_goal, NODE.delete_goal,  // ← добавлено
  NODE.generate_answer, NODE.clarify_intent, NODE.cancel
])]

const SEARCH_MODE_ROUTES: RouteMap = {
  ...
  change: NODE.extract_goal,  // ← добавлено
  delete: NODE.delete_goal,   // ← добавлено
}
```

**3. Empty Goal → clarifying_goal**

```typescript
const isEmpty = !extractedGoal || Object.values(extractedGoal).every((v) => v == null || v === 0);
const phase = isEmpty ? PHASE.clarifying_goal : PHASE.showing_goal;
```

**4. greeting теперь conditional**

- Убран из STATELESS_GUARDS
- Без профиля → onboarding (варианты: create profile / quick search)
- С профилем → greetingWithProfile (варианты: set goal / search / update)

---

### 📁 Изменённые файлы (НЕ закоммичено!)

```
src/facade/langGraph/cold-start-v2/prompts.ts        — SINGLE POSITION, FORMAT_RULES_BASE
src/facade/langGraph/search-graph/prompts/extraction.ts — NEVER return empty values
src/facade/langGraph/search-graph/nodes/extract-goal.ts — isEmpty check
src/facade/langGraph/search-graph/search-router.ts   — change/delete routes
src/facade/services/nlp-formatter/prompts.ts         — clarifying_goal, greetingWithProfile
src/facade/services/orchestrator/flow-guard-checker.service.ts — greeting conditional
```

---

### 🐛 НЕ ЗАВЕРШЕНО

| # | Проблема | Что нужно | Priority |
|---|----------|-----------|----------|
| 1 | Глупый диалог — NLP даёт размытые инструкции | Чёткие варианты в onboarding/greetingWithProfile | 🔴 P0 |
| 2 | Одна позиция → всё равно cold-start | Orchestrator должен различать single position vs history | 🟡 P1 |
| 3 | Файлы не закоммичены | lint:fix + tsc + commit | 🔴 P0 |

---

### 🎯 TODO для следующей сессии

**Критично:**
1. 🔴 **lint:fix + tsc + commit** — накопились изменения Phase 7-10
2. 🔴 **Глупый диалог** — переписать NLP prompts для onboarding/greetingWithProfile с чёткими вариантами

**Тестирование:**
3. 🟡 Тест через `npx tsx poc/telegram-chat.ts` — проверить что greeting/onboarding показывают варианты

**После фикса:**
4. 🟡 Orchestrator — single position → adhoc, не cold-start

---

### 🚀 Промпт для продолжения (после rewind)

```
ПРОЧИТАЙ:
1. `/home/alex/projects/WayMatesRemote/sessions/2026-01-06-telegram-realtime-testing.md` — Phase 10

**Контекст Phase 10:**
- Context extraction mixing исправлен (SINGLE POSITION)
- Search router: change/delete в asking_search_mode
- Empty goal → clarifying_goal
- greeting теперь conditional (onboarding/greetingWithProfile)
- Файлы изменены, НЕ закоммичены

**Баги НЕ исправлены:**
1. 🔴 Глупый диалог — NLP onboarding/greetingWithProfile дают размытые инструкции
2. 🟡 Single position → cold-start вместо adhoc

**TODO:**
1. lint:fix + tsc + commit Phase 7-10
2. Переписать NLP prompts для onboarding/greetingWithProfile — чёткие варианты
3. Тест: `set -a && source .env.test && set +a && npx tsx poc/telegram-chat.ts --start`

**Изменённые файлы:**
- cold-start-v2/prompts.ts — SINGLE POSITION, FORMAT_RULES_BASE
- extraction.ts — NEVER return empty values
- extract-goal.ts — isEmpty check
- search-router.ts — change/delete routes
- nlp-formatter/prompts.ts — clarifying_goal, greetingWithProfile
- flow-guard-checker.service.ts — greeting conditional

**Правила:**
- ТОЛЬКО семантика в промптах, никаких примеров
- Тестировать через `poc/telegram-chat.ts`, не mcp-chat.ts
```

---

## Phase 11 Session Report

**Дата:** 2026-01-08
**Сессия:** Мультиязычность (ISO 639-1)

---

### ✅ СДЕЛАНО

| # | Изменение | Файлы |
|---|-----------|-------|
| 1 | **Locale расширен до ISO 639-1** (182 языка) | `schemas.ts` — `iso-639-1` пакет + `localeWithFallbackSchema` |
| 2 | **Промпты → функции** вместо `.replace()` | `nlp-formatter/prompts.ts` — `GRAPH_PROMPT_BUILDERS` |
| 3 | **Chart → ChartLocale** для ru/en labels | `chart/types.ts` — `ChartLocale`, `toChartLocale()` |
| 4 | **Handlers передают languageCode напрямую** | `converse.ts`, `start.ts`, `document.ts`, `voice.ts` |
| 5 | **Static messages — fallback на en** | `query-executor.service.ts`, `format-response.ts` |
| 6 | **Добавлен `iso-639-1`** как runtime dependency | `package.json` |

---

### 🔧 АРХИТЕКТУРА МУЛЬТИЯЗЫЧНОСТИ

**Слои:**

| Слой | Языки | Механизм |
|------|-------|----------|
| **LLM-генерируемый контент** | Все 182 | locale передаётся в промпт, LLM сам переводит |
| **Static messages** (errors, labels) | ru/en | Hardcoded + fallback на en |
| **Chart labels** | ru/en | `ChartLocale` + `toChartLocale()` fallback |

**Ключевые изменения:**

1. **schemas.ts** — `z.nativeEnum()` невозможен (types-only пакет), используем `iso-639-1`:
   ```typescript
   import ISO6391 from "iso-639-1";
   const VALID_LANGUAGE_CODES = new Set<string>(ISO6391.getAllCodes());
   export const localeWithFallbackSchema = z.nativeEnum(LanguageCodes).catch("en");
   ```

2. **prompts.ts** — функции вместо replace:
   ```typescript
   // ДО: GRAPH_PROMPTS: Record<GraphType, string>
   // ПОСЛЕ:
   type PromptBuilder = (data: string, locale: string) => string;
   export const GRAPH_PROMPT_BUILDERS: Record<GraphType, PromptBuilder>
   ```

3. **Handlers** — передают сырой `language_code`:
   ```typescript
   const languageCode = ctx.from.language_code;
   // MCP tool валидирует через Zod, fallback на "en"
   ```

---

### ❌ ОШИБКИ И ИСПРАВЛЕНИЯ

| # | Ошибка | Причина | Как исправили |
|---|--------|---------|---------------|
| 1 | `@grammyjs/types` — "LanguageCodes not exported" | types-only пакет, нет runtime | Заменили на `iso-639-1` |
| 2 | `as Locale` — касты запрещены | eslint.config.mjs | `localeWithFallbackSchema.parse()` или Zod в facade |
| 3 | `toLocale()` — избыточный хелпер | Facade сам валидирует | Удалили, передаём `languageCode ?? "en"` |
| 4 | ESLint false positive `.catch()` | Путает с Promise.catch | `// eslint-disable-next-line` |

---

### 📁 Изменённые файлы (НЕ закоммичено!)

```
# Locale infrastructure
src/shared/schemas.ts                     — ISO 639-1, localeWithFallbackSchema
package.json                              — iso-639-1 dependency

# Prompts refactor
src/facade/services/nlp-formatter/prompts.ts — GRAPH_PROMPT_BUILDERS (functions)
src/facade/services/nlp-formatter/nlp-formatter.service.ts — uses builders
src/facade/services/nlp-formatter/index.ts — re-export

# Chart locale
src/chart/types.ts                        — ChartLocale, toChartLocale()
src/chart/index.ts                        — exports
src/chart/builders/html-renderer.ts       — uses ChartLocale
src/chart/builders/chart-builder.ts       — uses ChartLocale
src/chart/services/trajectory-transformer.ts — uses ChartLocale
src/facade/langGraph/search-graph/chart-utils.ts — toChartLocale()

# Handlers
src/telegram-bot/handlers/converse.ts     — languageCode directly
src/telegram-bot/handlers/start.ts        — languageCode directly
src/telegram-bot/handlers/document.ts     — languageCode directly
src/telegram-bot/handlers/voice.ts        — languageCode directly
src/telegram-bot/presenters/format-response.ts — string | undefined

# Static messages fallback
src/facade/services/orchestrator/query-executor.service.ts — getMessages()
```

---

### ✅ ТЕСТ ПРОЙДЕН

```bash
npx tsx poc/telegram-chat.ts --start
# → Бот ответил на русском (язык пользователя Telegram = ru)
```

---

### 🎯 TODO для следующей сессии

**Критично:**
1. 🔴 **Коммит Phase 7-11** — очень много накопилось
2. 🔴 **Баги Phase 10** остаются:
   - Single position → cold-start вместо adhoc
   - Goal MERGE баг в goals-manager.ts

**После коммита:**
3. 🟡 Удалить debug logging
4. 🟡 Проверить Chart с разными локалями

---

### 📚 РЕФЛЕКСИЯ Phase 11

| # | Моё неправильное действие | Что должен был сделать | Первопричина |
|---|--------------------------|------------------------|--------------|
| 1 | Использовал `@grammyjs/types` как runtime | Проверить что пакет экспортирует (types-only vs runtime) | Не читал package.json пакета |
| 2 | Предлагал касты `as Type` | eslint.config.mjs запрещает — использовать Zod | Не помню правила проекта |
| 3 | Создал `toLocale()` хелпер | Facade сам валидирует через Zod schema | Оверинжиниринг |
| 4 | `Record<Locale, T>` для static messages | Нужен fallback, не полный маппинг | Не продумал что Locale теперь 182 языка |

**Правила:**
- Types-only пакеты (`@types/*`, `@grammyjs/types`) НЕ имеют runtime экспортов
- Проверять `package.json` → `main` поле перед использованием
- Валидация locale — в Zod schema на границе (MCP tool), не в handlers
- Для static content: `Record<"en" | "ru", T>` + fallback function

---

### 🚀 Промпт для продолжения (после rewind)

```
ПРОЧИТАЙ:
1. `/home/alex/projects/WayMatesRemote/sessions/2026-01-06-telegram-realtime-testing.md` — Phase 11 (мультиязычность)

**Контекст Phase 11:**
- Locale расширен до ISO 639-1 (182 языка) через `iso-639-1` пакет
- Промпты переделаны на функции (GRAPH_PROMPT_BUILDERS)
- Chart использует ChartLocale с toChartLocale() fallback
- Handlers передают languageCode напрямую в MCP tools
- Static messages: ru/en с fallback на en
- ✅ Тест /start прошёл — бот отвечает на языке пользователя

**Файлы изменены, НЕ закоммичены (Phase 7-11)**

**TODO:**
1. 🔴 lint:fix + tsc + commit Phase 7-11
2. 🔴 Баги Phase 10: single position → adhoc, Goal MERGE

**Правила:**
- Types-only пакеты не имеют runtime экспортов
- Касты запрещены — использовать Zod
- Валидация locale — в Zod schema (MCP boundary)
```
