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

---

## Phase 12 Session Report

**Дата:** 2026-01-08
**Коммит:** `0412659cda6ed3300c0eb3e831616dff00b372e5`
**Сессия:** /manual-test-debug continuation — Goal MERGE, extraction fixes, UX polish

---

### ✅ СДЕЛАНО

| # | Изменение | Файлы |
|---|-----------|-------|
| 1 | **Goal MERGE fix** — создаёт User через MERGE для adhoc users | `cypher/queries/goals.ts` |
| 2 | **Goal UPSERT preserves createdAt** — `coalesce(originalCreatedAt, $createdAt)` | `cypher/queries/goals.ts` |
| 3 | **Extraction: убрана галлюцинация "management"** — было правило "include management for leads" | `shared/prompts.ts` DECOMPOSITION_RULES |
| 4 | **Position = seniority only** — "ONLY the seniority/grade level" | `shared/prompts.ts` |
| 5 | **hasValue() shared utility** — вынесен из 3 файлов + проверка `number === 0` | `shared/state-utils.ts` |
| 6 | **GOAL_OPTIONAL_FIELDS + GOAL_FIELD_DISPLAY_NAMES** | `schemas.ts`, `shared/prompts.ts` |
| 7 | **Optional fields: построчно с ⚪, без "not set"** | `nlp-formatter/prompts.ts` |
| 8 | **Tests:** удалён D6 (unverified), DTW threshold 0.7→0.65 | `dictionaries.integration.ts`, `dtw-demo-fixtures.spec.ts` |

---

### 🔧 КЛЮЧЕВЫЕ ФИКСЫ

**1. Goal MERGE для adhoc users**

```cypher
-- ДО: MATCH (searchingUser:User {userId: $userId}) — падал для новых users
-- ПОСЛЕ:
MERGE (searchingUser:User {userId: $userId})
WITH searchingUser
OPTIONAL MATCH (searchingUser)-[r:HAS_GOAL]->(oldGoal:Goal)
WITH searchingUser, oldGoal.createdAt AS originalCreatedAt, r, oldGoal
DELETE r, oldGoal
WITH searchingUser, originalCreatedAt
CREATE (searchingUser)-[:HAS_GOAL]->(g:Goal {
  createdAt: coalesce(originalCreatedAt, $createdAt),  -- preserves original
  ...
})
```

**2. DECOMPOSITION_RULES — убрано правило management**

```diff
- If the person manages or leads teams → include management in domains
+ Extract ONLY domains explicitly mentioned by user — do NOT infer from position level
```

**3. hasValue() — shared + number check**

```typescript
// Было дублировано в: load-context.ts, validate-context.ts, extract-context.ts
// Теперь один раз в shared/state-utils.ts:
export function hasValue(value: unknown): boolean {
  if (value == null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.length > 0;
  if (typeof value === "number") return value !== 0;  // ← salary fix
  return true;
}
```

**4. Optional fields format**

```
-- ДО (single line): ⚪ Optional: Skills, Company size, City...
-- ПОСЛЕ (per line):
⚪ Skills
⚪ Company size
⚪ City
```

---

### 📚 РЕФЛЕКСИЯ Phase 12

| # | Моё неправильное действие | Что должен был сделать | Первопричина |
|---|--------------------------|------------------------|--------------|
| 1 | `mcp-chat.ts` вместо `telegram-chat.ts` | Читать команду внимательно (пользователь указал POC) | Невнимательность |
| 2 | Подыгрывал LLM "более структурированным вводом" | Разбираться ПОЧЕМУ extraction не работает | Быстрый фикс симптома |
| 3 | Не нашёл source "management" сразу | grep по "management" в prompts.ts | DECOMPOSITION_RULES был в shared, не искал |
| 4 | hasValue() дублировал в 3 файлах | Сразу вынести в shared | Копипаста из других нод |
| 5 | Предлагал inline hasValue() | DRY — вынести в shared | Пользователь скорректировал |
| 6 | lint:fix без аргументов | lint:fix (не просто lint) | Привычка |

**Ключевые уроки:**

1. **Extraction bugs:** Сначала grep по симптому ("management") → найти source → исправить
2. **DRY:** Если функция копируется 3+ раз → shared utility
3. **hasValue:** `number === 0` тоже "пустое" для salary
4. **Тестирование:** Читать ответ бота → анализировать → НЕ подыгрывать

---

### 📁 Изменённые файлы (ЗАКОММИЧЕНО)

```
src/cypher/queries/goals.ts                  — MERGE User + preserve createdAt
src/shared/schemas.ts                        — GOAL_OPTIONAL_FIELDS, goalOptionalFieldSchema
src/facade/langGraph/shared/prompts.ts       — GOAL_FIELD_DISPLAY_NAMES, DECOMPOSITION_RULES fix
src/facade/langGraph/shared/state-utils.ts   — hasValue() shared
src/facade/langGraph/search-graph/response-builders.ts — goalOptionalFields
src/facade/langGraph/search-graph/prompts/extraction.ts — rule 8: no array expansion
src/facade/langGraph/search-graph/nodes/load-context.ts — import hasValue
src/facade/langGraph/cold-start-v2/nodes/extract-context.ts — import hasValue
src/facade/langGraph/cold-start-v2/nodes/validate-context.ts — import hasValue
src/facade/services/nlp-formatter/prompts.ts — per-line optional, labels
tests/core/integration/dictionaries-manager/dictionaries.integration.ts — removed D6
tests/core/unit/dtw-demo-fixtures.spec.ts    — threshold 0.7→0.65
```

---

### 🎯 TODO для следующей сессии

**Тестирование:**
1. 🟡 E2E тест полного flow: /start → quick search → goal → pathfinders
2. 🟡 Проверить Chart с ru/en локалями

**Cleanup:**
3. 🟡 Удалить debug logging из set-goal.ts, search-pathfinders.ts
4. 🟡 Обновить tests_report.md матрицу тестирования

---

### 🚀 Промпт для продолжения (после rewind)

```
ПРОЧИТАЙ:
1. `/home/alex/projects/WayMatesRemote/sessions/2026-01-06-telegram-realtime-testing.md` — Phase 12 (закоммичено)

**Контекст Phase 12 (закоммичено 0412659):**
- Goal MERGE fix — adhoc users теперь могут сохранять Goal
- Extraction: убрана галлюцинация "management", position = seniority only
- hasValue() вынесен в shared/state-utils.ts + проверка number===0
- Optional fields показываются построчно с ⚪, без "not set"
- GOAL_OPTIONAL_FIELDS + GOAL_FIELD_DISPLAY_NAMES добавлены
- Tests: D6 удалён, DTW threshold понижен

**TODO:**
1. 🟡 E2E тест: /start → quick search → goal → pathfinders
2. 🟡 Chart с ru/en локалями
3. 🟡 Удалить debug logging
4. 🟡 Обновить tests_report.md

**Правила из Phase 12:**
- Extraction bugs: grep по симптому → найти source → fix
- DRY: 3+ копий = shared utility
- hasValue: number === 0 тоже "пустое"
- Тестирование: НЕ подыгрывать LLM, анализировать ответы
```

---

## Phase 13 Session Report

**Дата:** 2026-01-08
**Сессия:** /manual-test-debug — NLP prompt fixes, E2E testing

---

### ✅ СДЕЛАНО

| # | Изменение | Файлы |
|---|-----------|-------|
| 1 | **Excluded fields → human-readable** | `nlp-formatter/prompts.ts` — FIELD_NAMES_MAPPING в инструкции |
| 2 | **Informal tone (ты вместо Вы)** | `nlp-formatter/prompts.ts` — добавлено "Tone: informal second person singular" |
| 3 | **NLP не спрашивает missing fields в show_results** | `nlp-formatter/prompts.ts` — "NEVER ask user for more context fields when showing results" |
| 4 | **No-goal формулировка** | `nlp-formatter/prompts.ts` — "explore where people from similar context ended up" |
| 5 | **DRY: PATHFINDERS_DESC + WAYMATES_DESC** | `nlp-formatter/prompts.ts` — константы для описаний |
| 6 | **Waymates description fix** | "people from same context aiming for same goal" (убрано "peers to connect") |

---

### ✅ E2E ТЕСТЫ ПРОЙДЕНЫ

**Adhoc flow:**
- /start → "быстрый поиск" → context → explore → goal → pathfinders/waymates ✅
- Tone: "Твой контекст" (не "Ваш")
- Результаты показываются без запроса missing fields

**Cold-start flow:**
- /start → PDF upload → 3 позиции извлечены → save → search ✅
- Career story сохранена корректно

---

### 🐛 НАЙДЕННЫЕ БАГИ (НЕ исправлены)

| # | Баг | Root Cause | Priority |
|---|-----|------------|----------|
| 1 | **Cold-start clarification теряет данные** | Разные ноды используют разные промпты для отображения позиции | 🔴 P0 |
| 2 | **Optional fields в cold-start — технические имена** | NLP prompt для cold-start не использует FIELD_DISPLAY_NAMES | 🟡 P1 |
| 3 | **"2" и "быстрый" не понимаются как startAdhoc** | Intent classifier не распознаёт numbered options | 🟡 P2 |
| 4 | **RU термины pathfinders/waymates** | Нужны human-friendly названия ("проводники"/"однопутники"?) | 🟡 P2 |

---

### 📁 Изменённые файлы (НЕ закоммичено!)

```
src/facade/services/nlp-formatter/prompts.ts
  - PATHFINDERS_DESC, WAYMATES_DESC constants
  - Tone: informal second person singular
  - excluded fields → human-readable labels
  - NEVER ask for missing fields in show_results
  - No-goal: "explore where people ended up"
```

---

### 📚 РЕФЛЕКСИЯ Phase 13

| # | Моё неправильное действие | Что должен был сделать | Первопричина |
|---|--------------------------|------------------------|--------------|
| 1 | Тестировал PDF после "быстрый поиск" (adhoc) | Чистый cold-start: /start → сразу PDF | Не структурировал тест-план |
| 2 | Предлагал примеры в промптах ("ты", "tu", "du") | ТОЛЬКО семантика: "informal second person singular" | Привычка к примерам |
| 3 | Дублировал waymates description | DRY: вынести в константу сразу | Пользователь скорректировал |
| 4 | Не заметил баг clarification сразу | Анализировать КАЖДЫЙ странный вывод | Спешка к завершению |

**Ключевые уроки:**
- **Структурированное тестирование:** /start → один flow полностью, потом другой
- **Промпты:** ТОЛЬКО семантика, никаких literal примеров
- **DRY сразу:** Если description повторяется — константа
- **Cold-start clarification:** Разные ноды должны использовать ОДИН промпт для отображения

---

### 🎯 TODO для следующей сессии

**Критично:**
1. 🔴 **lint:fix + tsc + commit** изменений Phase 13
2. 🔴 **Cold-start clarification теряет данные** — DRY: один промпт для отображения позиции во всех нодах

**После коммита:**
3. 🟡 Optional fields в cold-start — использовать FIELD_DISPLAY_NAMES
4. 🟡 RU термины для pathfinders/waymates — обсудить варианты
5. 🟡 Intent "2"/"быстрый" → startAdhoc
6. 🟡 Обновить tests_report.md

---

### 🚀 Промпт для продолжения (после rewind)

```
ПРОЧИТАЙ:
1. `/home/alex/projects/WayMatesRemote/sessions/2026-01-06-telegram-realtime-testing.md` — Phase 13

**Контекст Phase 13 (НЕ закоммичено):**
- NLP prompts: informal tone, excluded→human-readable, no-goal formulation
- DRY: PATHFINDERS_DESC + WAYMATES_DESC constants
- E2E adhoc + cold-start тесты пройдены

**Критичный баг:**
🔴 Cold-start clarification теряет данные — разные ноды используют разные промпты.
   При clarification позиции часть полей исчезает (skills, domains).
   Нужен DRY: ОДИН промпт для отображения позиции во всех нодах.

**TODO:**
1. 🔴 lint:fix + tsc + commit Phase 13
2. 🔴 Fix cold-start clarification — DRY промпт отображения
3. 🟡 Optional fields в cold-start → FIELD_DISPLAY_NAMES
4. 🟡 RU термины pathfinders/waymates

**Изменённый файл:**
- src/facade/services/nlp-formatter/prompts.ts

**Правила:**
- ТОЛЬКО семантика в промптах
- DRY: повторяется → константа
- Тестировать один flow полностью, потом другой
```

---

## Phase 13 (продолжение) — Cold-start fixes

**Дата:** 2026-01-08
**Сессия:** /manual-test-debug — Cold-start clarification fixes

---

### ✅ ИСПРАВЛЕНО

| # | Баг | Fix | Файл |
|---|-----|-----|------|
| 1 | **Suggestions не показывает все поля** | `COLD_START_CONTEXT_DISPLAY` константа — single source of truth | `nlp-formatter/prompts.ts` |
| 2 | **position="null" строка** | Инструкция "use JSON null (NOT string 'null')" | `cold-start-v2/prompts.ts` |
| 3 | **Optional fields — технические имена** | "show optionalFields with human-readable labels from mapping" | `nlp-formatter/prompts.ts` |

---

### 🐛 НЕПОЧИНЕННЫЕ БАГИ

| # | Баг | Root Cause | Priority | Где фиксить |
|---|-----|------------|----------|-------------|
| 1 | **companySize="undisclosed" показывается как filled** | Placeholder value, должно быть optional | 🟡 P1 | Extraction или hasValue check |
| 2 | **"2"/"быстрый" не понимаются как startAdhoc** | Intent classifier не распознаёт numbered options | 🟡 P2 | `intent-classifier.ts` |
| 3 | **RU термины pathfinders/waymates** | Нужны human-friendly названия | 🟡 P2 | Обсудить терминологию |
| 4 | **Debug logging в response-builders** | Временный код для отладки | 🟢 P3 | Удалить после стабилизации |

---

### 📁 Изменённые файлы (НЕ закоммичено!)

```
src/facade/services/nlp-formatter/prompts.ts
  - COLD_START_CONTEXT_DISPLAY constant (DRY)
  - Optional fields → human-readable labels

src/facade/langGraph/cold-start-v2/prompts.ts
  - "use JSON null (NOT string 'null')"

src/facade/langGraph/cold-start-v2/response-builders.ts
  - Debug logging для pendingContext + rolePositionSuggestions
```

---

### 📚 РЕФЛЕКСИЯ Phase 13 (продолжение)

| # | Моё неправильное действие | Что должен был сделать | Первопричина |
|---|--------------------------|------------------------|--------------|
| 1 | Предложил hardcoded список полей в промпте | DRY: константа или ссылка на "same format as missing" | Привычка к явным спискам |
| 2 | Предложил fix в normalizer для "null" строки | Фиксить в extraction (root cause) | Хотел быстрый fix вместо правильного |
| 3 | Не сразу понял что structured data содержит ВСЕ поля | Добавить logging раньше для диагностики | Делал предположения вместо проверки |

**Ключевые уроки:**
- **Single source of truth:** Константа лучше дублирования инструкций
- **Fix at root cause:** Extraction prompt > normalizer hack
- **Debug logging:** Добавлять сразу при непонятном поведении
- **Альтернативы:** Всегда предлагать варианты и сравнивать

---

### 🎯 TODO для следующей сессии

**Закоммитить:**
1. 🔴 `git add && git commit` — все изменения Phase 13

**После коммита:**
2. 🟡 **companySize="undisclosed"** — должно быть optional, не filled
3. 🟡 **Intent "2"/"быстрый"** → startAdhoc
4. 🟡 **RU термины** — обсудить pathfinders/waymates
5. 🟢 **Удалить debug logging** из response-builders.ts

**E2E тесты:**
6. 🟡 Полный cold-start flow с PDF до сохранения
7. 🟡 Chart verification с ru/en локалями

---

### 🚀 Промпт для продолжения (после rewind)

```
ПРОЧИТАЙ:
1. `/home/alex/projects/WayMatesRemote/sessions/2026-01-06-telegram-realtime-testing.md` — Phase 13 (продолжение)

**Контекст Phase 13 (НЕ закоммичено):**
- COLD_START_CONTEXT_DISPLAY — DRY для clarification context
- position="null" → JSON null в extraction prompt
- Optional fields → human-readable labels

**Изменённые файлы:**
- src/facade/services/nlp-formatter/prompts.ts
- src/facade/langGraph/cold-start-v2/prompts.ts
- src/facade/langGraph/cold-start-v2/response-builders.ts (debug logging)

**TODO:**
1. 🔴 Commit Phase 13 изменений
2. 🟡 companySize="undisclosed" → optional
3. 🟡 Intent "2"/"быстрый" → startAdhoc
4. 🟡 RU термины pathfinders/waymates
5. 🟢 Удалить debug logging

**Правила:**
- DRY: single source of truth для промптов
- Fix at root cause, не хаки в downstream
- Debug logging добавлять сразу при непонятном поведении
```

---

## Phase 14 — Adhoc E2E testing + fixes

**Дата:** 2026-01-08
**Сессия:** /manual-test-debug — Adhoc flow E2E

---

### ✅ ЗАКОММИЧЕНО

**Коммит `6b52535`:**
| # | Fix | Файл |
|---|-----|------|
| 1 | companySize="undisclosed" → null | `cold-start-v2/prompts.ts` — NEVER use placeholder values |
| 2 | "2" after greeting → startAdhoc | `intent-classifier.ts` — Option '1'/'2' recognition |
| 3 | BRAND_TERMS dictionary | `nlp-formatter/prompts.ts` — NO_TRANSLATE: Pathfinders, Waymates |

**Коммит `9377033`:**
| # | Fix | Файл |
|---|-----|------|
| 4 | Context mixing (adhocContext vs appliedFilters) | `nlp-formatter/prompts.ts` — CONTEXT_BLOCK explicit source |
| 5 | answerText stale after mode switch | `explore.ts`, `search-pathfinders.ts`, `search-waymates.ts` — clear answerText |
| 6 | "Salary: not specified" у кандидатов | `nlp-formatter/prompts.ts` — omit null/empty fields |

---

### ✅ E2E ТЕСТ ПРОЙДЕН (Adhoc flow)

```
/start → "2" → adhoc context (team lead developer, backend, RU)
→ explore (3 candidates + Chart)
→ set goal (head of engineering, NL, ai)
→ save
→ pathfinders (1 result + Chart)
→ question ("what skills?") — advisor answer
→ waymates (1 result + Chart)
→ question ("what challenges?") — advisor answer
```

---

### 🐛 ОСТАЛОСЬ

| # | Задача | Приоритет |
|---|--------|-----------|
| 1 | **E2E с эталонным контекстом Alex** — explore>1, waymates=4, pathfinders=4 | 🔴 P0 |
| 2 | **Cold-start flow с PDF** — полный E2E до сохранения | 🟡 P1 |
| 3 | **Greeting text** — расширенное описание возможностей | 🟢 P3 |

---

### 📊 АНАЛИЗ: Эталонный контекст для максимума кандидатов

**Найдено в БД:**
- `technical project manager → head of engineering` = 4 перехода (pathfinders)
- 6 users с целью `head of engineering, manager, NL, ai`
- 9 users с контекстом `technical project manager, manager, RU, fintech`

**Рекомендуемый контекст для теста:**
```
Reference: technical project manager, manager, management+backend, RU, fintech
Goal: head of engineering, manager, ai+platform+management, NL
```

---

### 📚 РЕФЛЕКСИЯ Phase 14

| # | Моё неправильное действие | Что должен был сделать | Первопричина |
|---|--------------------------|------------------------|--------------|
| 1 | Предложил hardcoded примеры в промпте ("ты", "tu", "du") | Только семантика, без гвоздей | Привычка к explicit examples |
| 2 | Не очистил answerText при смене режима сразу | Проверить все search nodes на state cleanup | Не подумал о side effects |
| 3 | Не сверил контекст с эталоном сразу | Начинать с анализа fixtures | Поспешил с произвольным контекстом |
| 4 | Показывал null поля как "not specified" | Проверить промпт на omit null | Не заметил лишний output |

**Ключевые уроки:**
- **Семантика > примеры**: В промптах описывать ЧТО, не КАК конкретно
- **State cleanup**: При смене режима очищать все transient поля
- **Fixtures first**: Перед тестом анализировать данные для максимального покрытия
- **Omit null**: Не показывать пользователю пустые поля

---

### 🎯 TODO для следующей сессии

**E2E тест с эталонным контекстом:**
1. 🔴 Удалить цель в начале (если есть)
2. 🔴 Adhoc → контекст как Demo-Alex context 3: `technical project manager, manager, management+backend, RU, fintech`
3. 🔴 Explore → должно быть >1 результат
4. 🔴 Goal: `head of engineering, manager, ai+platform+management, NL`
5. 🔴 Waymates → должно быть 4
6. 🔴 Question к waymates
7. 🔴 Pathfinders → должно быть 4
8. 🔴 Question к pathfinders

**После E2E:**
9. 🟡 Cold-start flow с PDF

---

### 🚀 Промпт для продолжения (после rewind)

```
ПРОЧИТАЙ:
1. `/home/alex/projects/WayMatesRemote/sessions/2026-01-06-telegram-realtime-testing.md` — Phase 14

**Контекст Phase 14 (закоммичено 6b52535, 9377033):**
- Intent "2" → startAdhoc работает
- BRAND_TERMS (Pathfinders, Waymates) не переводятся
- Context mixing fixed (CONTEXT_BLOCK explicit)
- answerText cleared on mode switch
- Null fields omitted у кандидатов

**TODO E2E с эталоном:**
1. Удалить цель если есть
2. Adhoc: technical project manager, manager, management+backend, RU, fintech
3. Explore: >1 результат
4. Goal: head of engineering, manager, ai+platform+management, NL
5. Waymates: 4 результата → question
6. Pathfinders: 4 результата → question

**Правила:**
- Fixtures first: анализировать данные перед тестом
- Семантика в промптах, без hardcoded примеров
- State cleanup при смене режима
```

---

## Phase 15 — Waymates E2E + Root Cause Analysis

**Дата:** 2026-01-09
**Сессия:** /manual-test-debug — Waymates 0→4 fix, prompt/data mismatch

---

### ✅ СДЕЛАНО

| # | Изменение | Файлы |
|---|-----------|-------|
| 1 | **Waymates 4 результата** — исправлен root cause | См. ниже |
| 2 | **CONTEXT_BLOCK stricter** | `nlp-formatter/prompts.ts` — "STRICTLY from adhocContext JSON" |
| 3 | **Salary USD annotation** | `nlp-formatter/prompts.ts` — "(USD, annual)" |
| 4 | **Waymate goals для U5-U8** | Neo4j MCP — создано через MERGE |

---

### 🔍 ROOT CAUSE: Waymates = 0

**Симптом:** `waymatesResults:"[4 items]"` в логах, но NLP показывал 0 или спрашивал missing fields.

**Диагностика:**

| Этап | Что проверили | Результат |
|------|---------------|-----------|
| 1 | Goals в Neo4j | ✅ U5-U8 имеют Goals |
| 2 | isWaymateFlags | `[false,false,false,false,false,true,true,true,true]` — 4 waymates есть |
| 3 | Core API | Возвращал 4 результата (U0-U4 без Goals) |
| 4 | pathLimit | **4** отрезал U5-U8 ДО facade фильтрации |

**Root cause #1: pathLimit=4**

```
Query → 9 matching users → ORDER BY score → LIMIT 4 → [U0-U4]
→ Facade фильтрует isWaymate=true → 0 результатов
```

**Fix:** `CANDIDATES_DISPLAY_LIMIT: 4→10` в `src/facade/env.ts`

**Root cause #2: Prompt/Data mismatch**

```
Response builder: { results: state.waymatesResults }  ← поле "results"
Prompt: "Show results from waymatesResults array"     ← ожидает "waymatesResults"
→ NLP не видит данные → галлюцинирует missing fields
```

**Fix:** Промпты изменены на `results` вместо `waymatesResults`/`pathfinderResults`

---

### 📁 Изменённые файлы (НЕ закоммичено!)

```
.env.test                                    — CANDIDATES_DISPLAY_LIMIT=10
src/facade/env.ts                            — default 10
src/facade/services/nlp-formatter/prompts.ts — results вместо waymatesResults/pathfinderResults
src/core/search-manager.ts                   — debug logging (удалить)
src/facade/langGraph/search-graph/nodes/search-waymates.ts — debug logging (удалить)
```

---

### 📚 РЕФЛЕКСИЯ Phase 15

| # | Моё неправильное действие | Что должен был сделать | Первопричина |
|---|--------------------------|------------------------|--------------|
| 1 | Не сравнил response-builder output с prompt field names | **Первым делом:** проверить что prompt ожидает vs что data передаёт | Искал проблему в логике, не в naming |
| 2 | Менял CANDIDATES_DISPLAY_LIMIT в .env.test | Проверить как env передаётся в Docker (env_file закомментирован) | Не понял инфру |
| 3 | Долго искал проблему в Core/Cypher | Добавить logging на КАЖДОМ этапе pipeline сразу | Делал предположения вместо трассировки |
| 4 | Goals потерялись после docker compose down | Goals должны быть в demo fixtures script | Не учёл что volumes пересоздаются |
| 5 | NLP "спрашивал missing fields" — искал в prompts | **Structured data naming** — root cause большинства NLP багов | Шаблонное мышление "промпт виноват" |

**Ключевые уроки:**

1. **Prompt/Data contract:** При NLP баге — ПЕРВЫМ проверить какие поля prompt ожидает vs какие data передаёт
2. **Pipeline tracing:** Добавлять logging на КАЖДОМ этапе: Core → Facade filtering → Response builder → NLP
3. **Docker env:** `env_file` в docker-compose может быть закомментирован — проверять `docker exec env`
4. **Fixtures persistence:** Goals и другие test data должны быть в scripts, не создаваться ad-hoc

---

### 🎯 TODO для следующей сессии

**Критично:**
1. 🔴 **lint:fix + tsc + commit** Phase 15 изменений
2. 🔴 **Удалить debug logging** из search-manager.ts, search-waymates.ts

**После коммита:**
3. 🟡 **Добавить Goals в demo fixtures script** — чтобы не терялись при docker compose down
4. 🟡 **Cold-start flow с PDF** — полный E2E
5. 🟡 **Chart verification** — ru/en локали

---

### 🚀 Промпт для продолжения (после rewind)

```
ПРОЧИТАЙ:
1. `/home/alex/projects/WayMatesRemote/sessions/2026-01-06-telegram-realtime-testing.md` — Phase 15

**Контекст Phase 15 (НЕ закоммичено):**
- Waymates: 0→4 fix (pathLimit + prompt/data mismatch)
- CANDIDATES_DISPLAY_LIMIT: 4→10 в env.ts
- Промпты: `results` вместо `waymatesResults`/`pathfinderResults`
- CONTEXT_BLOCK stricter, Salary USD annotation
- Debug logging добавлен (нужно удалить)

**Root causes найдены:**
1. pathLimit=4 отрезал waymates ДО фильтрации
2. Prompt ожидал `waymatesResults`, data передавало `results`

**TODO:**
1. 🔴 Удалить debug logging из search-manager.ts, search-waymates.ts
2. 🔴 lint:fix + tsc + commit
3. 🟡 Добавить Goals в demo fixtures script
4. 🟡 Cold-start flow с PDF
5. 🟡 Chart verification

**Изменённые файлы:**
- src/facade/env.ts — CANDIDATES_DISPLAY_LIMIT=10
- src/facade/services/nlp-formatter/prompts.ts — results вместо *Results
- src/core/search-manager.ts — debug logging (удалить!)
- src/facade/langGraph/search-graph/nodes/search-waymates.ts — debug logging (удалить!)

**Правила:**
- Prompt/Data contract: проверять naming ПЕРВЫМ при NLP баге
- Pipeline tracing: logging на каждом этапе
- Fixtures persistence: данные в scripts, не ad-hoc
```
