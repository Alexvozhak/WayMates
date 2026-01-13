# Infrastructure Router - Docker Compose & Services

**Назначение**: Быстрая навигация по Docker инфраструктуре, profiles, зависимостям
**Когда загружать**: Работа с тестами (setup/teardown), добавление новых сервисов, проблемы с depends_on

---

## Docker Compose Profiles

**Source of truth**: `docker-compose.yml` (строки 1-237)

| Profile | Services | Когда использовать |
|---------|----------|-------------------|
| **prod** | neo4j-prod, redis-prod, postgres-prod | Локальная разработка / демо |
| **test** | neo4j-test, redis-test, postgres-test, core-test | Integration tests |
| **tools** | structurizr, structurizr-cli | C4 architecture docs |

**Ключевое правило**: ВСЕ сервисы ДОЛЖНЫ иметь `profiles: [...]` (иначе стартуют по умолчанию)

---

## Команды

**Source of truth**: `package.json` (строки 20-35)

**Production**:
```bash
npm run docker:prod:up       # Start prod services
npm run docker:prod:down     # Stop + remove
```

**Test** (выбрать нужный):
```bash
npm run test:setup           # Only neo4j-test + init schema
npm run test:facade:setup    # All test services (neo4j, redis, postgres, core)
npm run test:facade:teardown # Stop test services
```

**Правило**: Используй готовые npm scripts (они включают --env-file + --profile)

---

## Env переменные

**Source of truth**:
- `.env.test` (строки 1-25) - test окружение
- `.env.prod.sample` (строки 1-41) - production template

**Ключевые правила**:
1. **NO defaults** - никаких `${VAR:-default}` в docker-compose.yml
2. **UPPER_SNAKE_CASE** - naming convention
3. **POSTGRES_DB** (НЕ POSTGRES_DATABASE) - стандарт Postgres official image
4. **Явные порты** - prod и test на разных портах (7687/7689, 5432/5433)

**Проверка перед запуском**:
```bash
docker compose --env-file .env.test config --quiet  # Валидация
```

---

## depends_on Conditions

**Когда использовать**:

| Condition | Когда | Пример |
|-----------|-------|--------|
| `service_started` | Сервис без healthcheck ИЛИ порядок не критичен | Redis (нет healthcheck) |
| `service_healthy` | **ОБЯЗАТЕЛЬНО** для DB с инициализацией | Neo4j, PostgreSQL (schema init) |
| `service_completed_successfully` | One-shot миграции/валидация | N/A (пока не используется) |

**Текущие зависимости**:
- `core-test` → `neo4j-test: service_healthy` (Core требует готовую DB)

**❌ НЕ добавляй depends_on без healthcheck** - бесполезно (container started ≠ service ready)

---

## Healthchecks

**Правила**:
1. **curl + `-f` flag** - fail on HTTP errors (4xx, 5xx)
2. **Dedicated endpoint** - `/health` для приложений (НЕ root path)
3. **start_period** - для медленных сервисов (Neo4j: 10s, Core: 15s)

**Текущие**:
- Neo4j: `cypher-shell ... RETURN 1` (проверяет query execution)
- PostgreSQL: `pg_isready -U $USER` (проверяет connection)
- Redis: `redis-cli ping`
- Core: `curl -f http://localhost:${CORE_PORT}/health`

**❌ НЕ используй root path** для healthcheck (tRPC/API servers не обслуживают `/`)

---

## Запреты

**❌ НЕ делай**:
1. **Hardcoded ports/passwords** в docker-compose.yml (только `${VAR}`)
2. **Defaults через `:-`** (было: `${PORT:-7687}`, стало: `${PORT}`)
3. **Сервисы без profiles** (будут стартовать всегда)
4. **depends_on без condition** (default = service_started, часто недостаточно)
5. **Healthcheck без `-f`** для curl (скрывает ошибки)
6. **POSTGRES_DATABASE** (устаревшее, используй POSTGRES_DB)

**✅ ДЕЛАЙ**:
1. Используй npm scripts (не прямые docker compose команды)
2. Проверяй `docker compose config --quiet` перед запуском
3. Добавляй healthcheck для новых сервисов с инициализацией
4. Используй `service_healthy` для DB зависимостей

---

## Ссылки

**Документация**:
- Docker Compose file: `docker-compose.yml`
- Env конфиг: `.env.test`, `.env.prod.sample`
- Commands: `package.json` scripts (docker:*, test:*)

**Тесты**:
- Integration tests setup: `vitest.config.ts` (setupFiles)
- Test data fixtures: `data/trails/users/`

**Core**:
- Core health endpoint: `src/core/trpc-server.ts:16-19` (middleware)
- Facade PostgreSQL config: `src/facade/infrastructure/postgres.service.ts`
