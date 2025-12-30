# FEAT-054: Deploy на Fly.io

**Статус:** TODO
**Приоритет:** P0
**Зависимости:** FEAT-033 (Sentry), FEAT-032 (Pino)
**Блокирует:** Production Launch

---

## Контекст решения

### Почему Fly.io?

**Рассмотренные варианты:**

| Платформа | Цена/мес | Setup | Вердикт |
|-----------|----------|-------|---------|
| Hetzner VPS | ~$4 | 4-5ч, нужен Linux опыт | ❌ Нет опыта с Linux серверами |
| Fly.io | ~$19-25 | 2ч, CLI-first | ✅ **Выбран** |
| Railway | ~$40 | 30мин, UI only | ❌ Нет консольного доступа |
| Render | ~$50 | 30мин, UI only | ❌ Нет консольного доступа, дорого |

**Ключевые факторы:**
1. CLI доступ — возможность troubleshooting через `fly ssh console`
2. Баланс цена/удобство — дешевле Railway, проще Hetzner
3. SSH в контейнеры — при проблемах можно диагностировать
4. Не требует Linux admin навыков

### Требования к ресурсам

Расчёт для 10-20 concurrent users, 224 users в базе:

| Сервис | RAM | Конфигурация Fly.io | Цена/мес |
|--------|-----|---------------------|----------|
| neo4j | ~1GB | shared-cpu-1x 1GB + 10GB volume | ~$7 |
| postgres | ~256MB | shared-cpu-1x 256MB | ~$2 |
| redis | ~50MB | Upstash free tier | $0 |
| core | ~100MB | shared-cpu-1x 256MB | ~$2 |
| facade | ~150MB | shared-cpu-1x 512MB | ~$3 |
| telegram-bot | ~80MB | shared-cpu-1x 256MB | ~$2 |
| **ИТОГО** | ~2.5GB | | **~$19/мес** |

---

## Архитектура деплоя

```
┌─────────────────────────────────────────────────────────────┐
│                         Fly.io                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │telegram-bot │  │   facade    │  │    core     │          │
│  │  (grammY)   │──│  (FastMCP)  │──│   (tRPC)    │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
│         │                │                │                  │
│         └────────────────┼────────────────┘                  │
│                          │                                   │
│  ┌───────────────────────┼───────────────────────┐          │
│  │              Private Network                   │          │
│  ├───────────────────────┼───────────────────────┤          │
│  │  ┌─────────┐    ┌─────────┐    ┌─────────┐   │          │
│  │  │ neo4j   │    │postgres │    │  redis  │   │          │
│  │  │(volume) │    │         │    │(Upstash)│   │          │
│  │  └─────────┘    └─────────┘    └─────────┘   │          │
│  └───────────────────────────────────────────────┘          │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│  External:                                                   │
│  - Cloudflare R2 (charts)                                   │
│  - OpenRouter (LLM)                                         │
│  - Sentry (monitoring)                                      │
└─────────────────────────────────────────────────────────────┘
```

---

## План реализации

### Фаза 1: Подготовка (~30 мин)

- [ ] Установить flyctl: `curl -L https://fly.io/install.sh | sh`
- [ ] Авторизация: `fly auth login`
- [ ] Создать организацию/проект

### Фаза 2: Инфраструктура (~1 час)

- [ ] Создать Fly App для каждого сервиса
- [ ] Создать Volume для Neo4j: `fly volumes create neo4j_data --size 10`
- [ ] Настроить Upstash Redis (внешний, free tier)
- [ ] Создать Fly Postgres: `fly postgres create`

### Фаза 3: Конфигурация (~1 час)

- [ ] Написать `fly.toml` для telegram-bot
- [ ] Написать `fly.toml` для facade
- [ ] Написать `fly.toml` для core
- [ ] Написать `fly.toml` для neo4j
- [ ] Настроить secrets: `fly secrets set`

### Фаза 4: Деплой (~30 мин)

- [ ] Деплой Neo4j + инициализация схемы
- [ ] Деплой Postgres + миграции
- [ ] Деплой Core
- [ ] Деплой Facade
- [ ] Деплой Telegram Bot

### Фаза 5: Проверка (~30 мин)

- [ ] Проверить health endpoints
- [ ] Проверить связность сервисов
- [ ] Тест Telegram Bot
- [ ] Проверить логи: `fly logs`
- [ ] Проверить Sentry alerts

---

## Конфигурация fly.toml (примеры)

### telegram-bot

```toml
app = "waymates-telegram"
primary_region = "ams"

[build]
  dockerfile = "Dockerfile"
  target = "telegram-bot"

[env]
  NODE_ENV = "production"
  LOG_LEVEL = "info"

[http_service]
  internal_port = 3000
  force_https = true

[[vm]]
  cpu_kind = "shared"
  cpus = 1
  memory_mb = 256
```

### neo4j

```toml
app = "waymates-neo4j"
primary_region = "ams"

[build]
  image = "neo4j:5-community"

[env]
  NEO4J_AUTH = "neo4j/password"
  NEO4J_server_memory_heap_max__size = "512m"
  NEO4J_server_memory_pagecache_size = "256m"

[mounts]
  source = "neo4j_data"
  destination = "/data"

[[vm]]
  cpu_kind = "shared"
  cpus = 1
  memory_mb = 1024
```

---

## Environment Variables (Secrets)

```bash
# Neo4j
fly secrets set NEO4J_PASSWORD=xxx -a waymates-neo4j

# Core
fly secrets set NEO4J_URI=xxx NEO4J_PASSWORD=xxx -a waymates-core

# Facade
fly secrets set \
  OPENROUTER_API_KEY=xxx \
  POSTGRES_URL=xxx \
  REDIS_URL=xxx \
  R2_ACCESS_KEY_ID=xxx \
  R2_SECRET_ACCESS_KEY=xxx \
  SENTRY_DSN=xxx \
  -a waymates-facade

# Telegram
fly secrets set \
  TELEGRAM_BOT_TOKEN=xxx \
  FACADE_MCP_URL=xxx \
  SENTRY_DSN=xxx \
  -a waymates-telegram
```

---

## Мониторинг и Troubleshooting

### Команды для диагностики

```bash
# Логи
fly logs -a waymates-facade

# SSH в контейнер
fly ssh console -a waymates-neo4j

# Статус
fly status -a waymates-core

# Метрики
fly dashboard -a waymates-facade

# Рестарт
fly apps restart waymates-telegram
```

### Health Checks

Каждый сервис должен иметь `/health` endpoint:

| Сервис | Endpoint | Проверяет |
|--------|----------|-----------|
| core | `GET /health` | Neo4j connection |
| facade | `GET /health` | Redis, Postgres, Core |
| telegram-bot | `GET /health` | Facade MCP |

---

## Acceptance Criteria

- [ ] Все 5 сервисов деплоятся без ошибок
- [ ] Telegram Bot отвечает на сообщения
- [ ] Cold-start flow работает
- [ ] Search flow работает
- [ ] Charts генерируются и загружаются в R2
- [ ] Sentry получает ошибки
- [ ] `fly logs` показывает structured logs (Pino)
- [ ] Health checks проходят

---

## Риски и митигации

| Риск | Митигация |
|------|-----------|
| Neo4j OOM | Мониторинг памяти, лимиты в env |
| Volume потеря данных | Fly snapshots, backup в R2 |
| Cold start delays | Keep-alive ping или min_machines_running |
| LLM timeout | Увеличить timeout в fly.toml |

---

## Оценка времени

| Фаза | Время |
|------|-------|
| Подготовка | 30 мин |
| Инфраструктура | 1 час |
| Конфигурация | 1 час |
| Деплой | 30 мин |
| Проверка | 30 мин |
| **ИТОГО** | **~3.5 часа** |

---

## Ссылки

- [Fly.io Docs](https://fly.io/docs/)
- [Fly.io Pricing](https://fly.io/docs/about/pricing/)
- [MVP-RELEASE-PLAN.md](../../docs/mvp_final/MVP-RELEASE-PLAN.md) — Фаза 7
