# Latest News: Инфраструктура тестирования

> Актуально для: FEAT-055 Demo Video, Phase 7.6+
> Дата: 2025-01-04 (обновлено)

---

## Документы для чтения перед стартом

**Обязательно прочитать ПОЛНОСТЬЮ:**

1. `.claude/context/guidelines.md` — правила, anti-patterns, принципы
2. `mvp-test-final/BUSINESS-LOGIC-MVP.md` — бизнес-логика, User Journey, режимы поиска
3. `mvp-test-final/KNOWLEDGE-BASE.md` — архитектура, flow, LangGraph, инфра
4. `mvp-test-final/tests_report.md` — матрица тестирования, роль токсичного пользователя
5. `sessions/2025-12-31-feat055-demo-video.md` — текущий session log

**Ключевые файлы кода (для понимания extraction flow):**

| Файл | Зачем читать |
|------|--------------|
| `src/facade/langGraph/shared/prompts.ts` | `DECOMPOSITION_RULES` — как LLM декомпозирует title → position/role/domains |
| `src/facade/langGraph/search-graph/prompts/extraction.ts` | Adhoc extraction prompt — структура, поля, правила |
| `src/facade/langGraph/cold-start-v2/prompts.ts` | Cold-start extraction — `contextExtractionPrompt()` |
| `src/facade/services/normalizer.ts` | Как `filterToKnown()` фильтрует к словарным значениям |
| `src/facade/services/dictionaries-cache.ts` | Redis cache логика, TTL, ключи |
| `tests/core/integration/search-manager/demo-fixtures.integration.ts` | `ALEX_REFERENCE_CONTEXT` — эталон для batch tests |
| `tests/e2e/batches/demo-adhoc.yaml` | Batch test сценарий adhoc flow |
| `tests/e2e/batches/demo-cold-start.yaml` | Batch test сценарий cold-start flow |
| `poc/test-pathfinder-search.ts` | Quick test для отладки pathfinder search (~5 сек) |

---

## 1. Архитектура тестовой среды

```
┌─────────────────────────────────────────────────────────────────┐
│                         Docker Compose                          │
├─────────────────────────────────────────────────────────────────┤
│  waymates-neo4j-test          (bolt://localhost:7689)          │
│  waymates-postgres-test       (localhost:5433) — checkpoints    │
│  waymates-redis-test          (localhost:6380) — sessions       │
│  waymates-core-test           (localhost:9000) — tRPC API       │
│  waymates-facade-test         (localhost:3001) — MCP Server     │
│  waymates-telegram-bot-test   (-) — Telegram bot (profile: test)│
└─────────────────────────────────────────────────────────────────┘
```

### Telegram Bot в Docker (NEW в Phase 7.6)

```bash
npm run bot:docker:up       # Запустить бота в Docker
npm run bot:docker:down     # Остановить
npm run bot:docker:restart  # Пересобрать
npm run bot:docker:clean    # Перезапуск с очисткой Redis сессий
npm run bot:docker:logs     # Логи
```

**Бот автоматически стартует при `npm run test:telegram:setup`.**

### Redis AOF Persistence (важно!)

Redis настроен с **AOF persistence** — сессии сохраняются между рестартами:
- Volume: `redis-test-data:/data`
- Config: `--appendonly yes`

**Что хранится в Redis:**
- `session:sess_xxx` — mapping sessionId → userId (TTL 7 дней)
- `waymates:dict:*` — словарный cache

**Что хранится в Postgres:**
- `facade.checkpoints` — LangGraph state snapshots
- `facade.users` — user records

---

## 2. Словари и их состояние

| Словарь | JSON файл | Neo4j Label | verified |
|---------|-----------|-------------|----------|
| Industries | `database/industries.json` | `:Industry` | true |
| Positions | `database/positions.json` | `:Position` | true |
| Roles | `database/roles.json` | `:Role` | **зависит от порядка импорта** |
| Domains | `database/domains.json` | `:WorkDomain` | true |

**КРИТИЧНО:** `src/cypher/queries/persistence.ts:127` создаёт словарные entries с `verified: false`. Если удалить словарь и импортировать fixtures — entries станут `verified: false` → `getVerified` вернёт `[]` → normalizer отфильтрует всё.

---

## 3. Порядок инициализации (ВАЖНО!)

```bash
# 1. Поднять инфру
npm run test:facade:setup

# 2. Инициализировать словари (verified=true)
npm run db:test:init

# 3. Импортировать demo fixtures (включает goals для waymates)
set -a && source .env.test && set +a && npx tsx scripts/import-demo-fixtures.ts

# 4. ПОВТОРНО инициализировать словари (перезапись verified=true после fixtures)
npm run db:test:init

# 5. Очистить Redis cache (иначе старые данные)
docker exec waymates-redis-test redis-cli KEYS "waymates:dict:*" | \
  xargs -r docker exec -i waymates-redis-test redis-cli DEL
```

---

## 4. Проверка состояния

```bash
# Docker
docker ps --format "table {{.Names}}\t{{.Status}}" | grep waymates

# Neo4j — словари verified (через MCP neo4j-cypher)
MATCH (r:Role) RETURN r.canonicalName, r.verified LIMIT 5

# Neo4j — demo fixtures
MATCH (u:User) WHERE u.userId STARTS WITH 'usr_019b0055' RETURN count(u)

# Neo4j — мусорные users (НЕ demo fixtures)
MATCH (u:User) WHERE NOT u.userId STARTS WITH 'usr_019b0055' RETURN u.userId

# Redis cache
docker exec waymates-redis-test redis-cli KEYS "waymates:dict:*"

# Очистка Redis cache
docker exec waymates-redis-test redis-cli KEYS "waymates:dict:*" | \
  xargs -r docker exec -i waymates-redis-test redis-cli DEL
```

---

## 5. Команды тестирования

```bash
# Batch tests
set -a && source .env.test && set +a
OPENROUTER_API_KEY=... npx tsx poc/mcp-chat.ts --session demo-adhoc --reset --batch tests/e2e/batches/demo-adhoc.yaml
OPENROUTER_API_KEY=... npx tsx poc/mcp-chat.ts --session demo-cold-start --reset --batch tests/e2e/batches/demo-cold-start.yaml

# Ручное тестирование (изолированные сессии!)
npx tsx poc/mcp-chat.ts --session <unique-name> "message"
npx tsx poc/mcp-chat.ts --session <unique-name> --reset
npx tsx poc/mcp-chat.ts --session <unique-name> --status

# Quick test для pathfinder search (~5 сек вместо 2 мин)
npx tsx poc/test-pathfinder-search.ts

# Integration tests
npx vitest tests/core/integration/search-manager/demo-fixtures.integration.ts --run

# ═══════════════════════════════════════════════════════════════
# FACADE REBUILD — ДВЕ КОМАНДЫ (критично!)
# ═══════════════════════════════════════════════════════════════

npm run facade:rebuild        # Сохраняет checkpoints — сессии работают
npm run facade:rebuild:clean  # Очищает checkpoints — сессии потеряны

# ┌──────────────────────┬─────────────────────────────────────────────┐
# │ Команда              │ Когда использовать                          │
# ├──────────────────────┼─────────────────────────────────────────────┤
# │ facade:rebuild       │ Изменения в ЛОГИКЕ:                         │
# │                      │ - prompts, nodes, services, tools           │
# │                      │ - extraction rules, normalization           │
# │                      │ - chart generation, response formatting     │
# ├──────────────────────┼─────────────────────────────────────────────┤
# │ facade:rebuild:clean │ Изменения в STATE SCHEMA:                   │
# │                      │ - новые поля в SearchStateType              │
# │                      │ - изменения ColdStartStateType              │
# │                      │ - переименование/удаление полей state       │
# └──────────────────────┴─────────────────────────────────────────────┘
```

---

## 6. Цепочка extraction → normalize

```
User message
    ↓
buildAdhocExtractionPrompt(hints)  ← DECOMPOSITION_RULES
    ↓
LLM extraction → {role: "manager", domains: [...], ...}
    ↓
normalizerService.normalizeAdhocContext()
    ↓
filterToKnown("role", "manager")
    ↓
dictionaryCache.getSimple("role")  ← Redis cache
    ↓
getVerified.query()  ← Core API → Neo4j WHERE verified=true
    ↓
dict.get("manager")  ← exact match по canonicalName.toLowerCase()
    ↓
Result: role сохраняется ИЛИ null (если verified=false)
```

---

## 7. ALEX_REFERENCE_CONTEXT (эталон для batch tests)

**Файл:** `tests/core/integration/search-manager/demo-fixtures.integration.ts` (строки 32-45)

```typescript
const ALEX_REFERENCE_CONTEXT: AdhocContextBase = {
  position: "technical project manager",
  role: "manager",
  domains: ["management", "backend"],
  countryCode: "RU",
  citizenships: ["RU"],
  industry: "fintech",
  skills: null,
  companySize: null,
  cityName: null,
  birthYear: null,
  educationLevel: null,
  languages: null,
};
```

**Цель batch tests:** воссоздать этот контекст через диалог. Если LLM extraction + normalizer создают идентичный контекст — pathfinder search найдёт 4 demo pathfinders.

---

## 8. Известные проблемы и решения

### Проблема 1: Role normalizer отбрасывает "manager"

| Аспект | Детали |
|--------|--------|
| **Симптом** | LLM извлёк `role: "manager"`, но после normalize — `null` |
| **Причина** | Redis cache содержал `[]` для roles, потому что `Role.verified = false` |
| **Корневая причина** | `persistence.ts` создаёт roles с `verified: false`. При удалении roles через `DETACH DELETE` и пересоздании через fixtures — теряется `verified: true` |
| **Решение** | **НЕ удалять dictionary nodes при очистке данных!** |

```cypher
-- ❌ НЕ делать:
MATCH (r:Role) WHERE r.canonicalName IN [...] DETACH DELETE r

-- ✅ Делать (только users):
MATCH (u:User) WHERE ... DETACH DELETE u
```

**Альтернатива:** Если словари уже испорчены — запустить `npm run db:test:init` и очистить Redis cache.

---

### Проблема 2: Pathfinder search возвращает 0 results (Core 55ms)

| Аспект | Детали |
|--------|--------|
| **Симптом** | Core отвечал за 55ms с 0 candidates, хотя Cypher напрямую находил 4 |
| **Причина** | `userContext` содержит `cityName: "rostov-on-don"`, pathfinders имеют `cityName: "Moscow"`. Strict match → 0 results |
| **Почему не было раньше** | В adhoc режиме `adhocContext` не содержит cityName. В profile режиме (cold-start) `userContext` содержит ВСЕ поля включая cityName |
| **Fix** | `adhocContextBase.parse(userContext)` в `search-pathfinders.ts:29` — конвертирует userContext, убирая лишние поля. `excludedContextFields` уже содержит `cityName` в `DEFAULT_EXCLUDED_CONTEXT_FIELDS` |
| **Реальная причина fail** | **Забыли `npm run facade:rebuild`** — Docker container содержал старый код |

**Правило:** После ЛЮБЫХ изменений в facade — ВСЕГДА `npm run facade:rebuild`, НЕ просто `docker restart`.

---

### Проблема 3: Мусорные users в результатах поиска

| Аспект | Детали |
|--------|--------|
| **Симптом** | Chart показывал 10 кандидатов вместо 4 waymates |
| **Причина** | Предыдущие batch tests создавали users которые оставались в Neo4j |
| **Механизм** | Demo fixtures и test users имеют похожий контекст (TPM, manager, fintech, RU) → поиск находит их как "похожих" |

**Как возникает:**

```
Batch test #1 (demo-adhoc)
├── Facade создаёт user: usr_019b7dea-xxxx
└── User ОСТАЁТСЯ в Neo4j

Batch test #2 (demo-cold-start)
├── Facade создаёт user: usr_019b7dec-xxxx
└── User ОСТАЁТСЯ

Batch test #3 (повторно)
├── Поиск waymates находит:
│   ├── 4 demo waymates ✅
│   ├── usr_019b7dea-xxxx (мусор от test #1) ❌
│   └── usr_019b7dec-xxxx (мусор от test #2) ❌
└── Chart показывает 10+ кандидатов
```

**Решение — очистка перед batch test:**

```bash
# Через MCP neo4j-cypher:
MATCH (u:User) WHERE NOT u.userId STARTS WITH 'usr_019b0055' DETACH DELETE u

# Или через CLI:
docker exec waymates-neo4j-test cypher-shell -u neo4j -p testpassword123 \
  "MATCH (u:User) WHERE NOT u.userId STARTS WITH 'usr_019b0055' DETACH DELETE u"
```

**Когда чистить:**
- Перед `--batch` запуском
- После падения batch test
- Когда chart показывает лишних кандидатов

---

## 9. Быстрая отладка charts

### Эталонные сессии

После успешных batch tests сохраняются сессии:

| Сессия | Тип | Состояние |
|--------|-----|-----------|
| `demo-adhoc` | Adhoc | После exploration, goal set |
| `demo-cold-start` | Cold-start | После CV, 3 contexts saved, goal set |

### Команды для быстрой отладки (~15 сек вместо 2 мин)

```bash
set -a && source .env.test && set +a

# Pathfinders chart (cold-start сессия)
OPENROUTER_API_KEY=sk-or-v1-your-key-here \
npx tsx poc/mcp-chat.ts --session demo-cold-start "Show me pathfinders"

# Waymates chart (cold-start сессия)
OPENROUTER_API_KEY=sk-or-v1-your-key-here \
npx tsx poc/mcp-chat.ts --session demo-cold-start "Show me waymates"

# Exploration chart (adhoc сессия)
OPENROUTER_API_KEY=sk-or-v1-your-key-here \
npx tsx poc/mcp-chat.ts --session demo-adhoc "Explore"
```

### Управление сессиями — КОГДА ЧТО ДЕЛАТЬ

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    СЕССИИ: ЗАГРУЗКА vs ПЕРЕСОЗДАНИЕ                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ✅ ЗАГРУЖАТЬ существующую сессию когда:                                    │
│  ───────────────────────────────────────                                    │
│  • facade:rebuild (БЕЗ :clean) — checkpoints сохранены                      │
│  • Рестарт контейнеров — Redis AOF сохраняет session mapping                │
│  • Продолжение работы с той же сессией                                      │
│                                                                             │
│  ❌ ПЕРЕСОЗДАВАТЬ сессию через batch когда:                                 │
│  ─────────────────────────────────────────                                  │
│  • facade:rebuild:clean — checkpoints очищены                               │
│  • Изменения в state schema — старые checkpoints несовместимы               │
│  • Изменения в extraction prompts — старые данные невалидны (createdAt fix) │
│  • Сессия "expired" — mapping в Redis, но checkpoint отсутствует            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Команды:**

```bash
# Статус сессии
npx tsx poc/mcp-chat.ts --session demo-cold-start --status

# Сброс сессии (удаляет только файл, не checkpoints)
npx tsx poc/mcp-chat.ts --session demo-cold-start --reset

# Список файлов сессий
ls -la .claude/sessions/mcp-chat-*.json

# Восстановить session в Redis (если потерялась)
docker exec waymates-redis-test redis-cli SET "session:SESS_ID" "USER_ID" EX 604800
```

### Пересоздание эталонных сессий (после :clean или schema changes)

```bash
set -a && source .env.test && set +a

# 1. Очистить мусорных users (обязательно!)
# через MCP neo4j-cypher:
MATCH (u:User) WHERE NOT u.userId STARTS WITH 'usr_019b0055' DETACH DELETE u

# 2. Пересоздать adhoc сессию (~1.5 мин)
OPENROUTER_API_KEY=... npx tsx poc/mcp-chat.ts --session demo-adhoc --reset --batch tests/e2e/batches/demo-adhoc.yaml

# 3. Пересоздать cold-start сессию (~4 мин)
OPENROUTER_API_KEY=... npx tsx poc/mcp-chat.ts --session demo-cold-start --reset --batch tests/e2e/batches/demo-cold-start.yaml
```

---

## 10. Quick tests (~10 сек вместо 3+ мин batch)

### Pathfinder search

**Файл:** `poc/test-pathfinder-search.ts`

```bash
set -a && source .env.test && set +a && npx tsx poc/test-pathfinder-search.ts
```

Тестирует: Core tRPC → pathfinder search → excludedContextFields.

### Chart (Overlap + DTW + Spider)

**Файл:** `poc/test-chart-overlap.ts`

```bash
set -a && source .env.test && set +a && npx tsx poc/test-chart-overlap.ts
```

Тестирует: demo-alex trajectory → pathfinders с DTW → chart generation → R2 upload.

**Overlap требует:** все 5 полей совпадают (position, role, domains, countryCode, industry). cityName исключён.

**Spider требует:** mode="full" + dtwMetrics > 0 (передать `userTrajectory` в search params).

---

## 11. Текущий статус (2025-01-04)

| Компонент | Статус |
|-----------|--------|
| Neo4j | 11 demo users, словари verified=true |
| Redis | AOF persistence, cache актуален |
| Facade | advisor bug fixed (PHASE_CONTEXT + answerText) |
| Telegram Bot | Docker service добавлен |
| demo-fixtures.integration.ts | ✅ 4/4 passed |
| demo-adhoc.yaml | ✅ 9/9 passed |
| demo-cold-start.yaml | ✅ 21/21 passed |
| demo-video-1-telegram.ts | ✅ 6/6 passed (GramJS) |

### Важные фиксы Phase 7.6

| Проблема | Root Cause | Fix |
|----------|------------|-----|
| ask intent → searchPathfinders | classification не знал что results показаны | +PHASE_CONTEXT в `classification.ts` |
| answerText не в NLP | JSON.stringify(undefined) → пустой объект | `?? null` в response-builders |
| NLP показывал answer + results | "FIRST, then" = последовательность | "ONLY answer" без results |

**Файлы:**
- `src/facade/langGraph/search-graph/prompts/classification.ts` — PHASE_CONTEXT map
- `src/facade/langGraph/search-graph/response-builders.ts` — `answerText: state.currentAnswer ?? null`
- `src/facade/services/nlp-formatter/prompts.ts` — "Show ONLY the answer"

### Chart с Overlap + DTW + Spider (demo-alex)

```bash
npx tsx poc/test-chart-overlap.ts
```

Генерирует chart: https://pub-3a26a622b51948949e572dc94789c1c6.r2.dev/c2fcbaad3ca78c9ee3ea928b1a7bfe76.html

---

## 12. Чеклист перед batch test

- [ ] `docker ps` — все 5 контейнеров Up и healthy
- [ ] Очистить мусорных users: `MATCH (u:User) WHERE NOT u.userId STARTS WITH 'usr_019b0055' DETACH DELETE u`
- [ ] Проверить demo fixtures: `MATCH (u:User) WHERE u.userId STARTS WITH 'usr_019b0055' RETURN count(u)` → должно быть 11
- [ ] Проверить roles verified: `MATCH (r:Role) RETURN r.canonicalName, r.verified LIMIT 3` → все true
- [ ] После изменений в facade логике: `npm run facade:rebuild` (сессии живы)
- [ ] После изменений в state schema: `npm run facade:rebuild:clean` + пересоздать сессии

---

## 13. Диагностика проблем с сессиями

| Ошибка | Причина | Решение |
|--------|---------|---------|
| "Session expired" | Session в Redis, но checkpoint нет | Пересоздать через batch |
| "Checkpoint not found" | facade:rebuild:clean очистил данные | Пересоздать через batch |
| Сессия работает, но данные старые | Нужны новые extraction prompts | Пересоздать через batch |
| Сессия пустая после рестарта | Redis volume отсутствовал | Проверить `redis-test-data` volume |

**Быстрая диагностика:**
```bash
# Проверить session в Redis
docker exec waymates-redis-test redis-cli GET "session:sess_019b7e13-xxx"

# Проверить checkpoints в Postgres
docker exec waymates-postgres-test psql -U postgres -d waymates_facade_test \
  -c "SELECT thread_id, COUNT(*) FROM facade.checkpoints GROUP BY thread_id;"

# Проверить Redis AOF работает
docker exec waymates-redis-test redis-cli CONFIG GET appendonly
# должно быть: appendonly yes
```
