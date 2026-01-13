# FEAT-030: Production Readiness

**Статус:** IN_PROGRESS
**Приоритет:** P0
**Фаза MVP:** 4

---

## Цель

Подготовить WayMates к production deployment (50-200 users, $20-50/мес).

---

## Текущее состояние (2025-12-21)

### Что реализовано

| Компонент | Модуль | Файл | Описание |
|-----------|--------|------|----------|
| **Rate Limit (user)** | telegram | `middleware/rate-limit.ts` | grammY plugin, 3 req/10s per user |
| **Rate Limit (LLM)** | telegram | `presenters/base-presenter.ts` | Bottleneck, 60 RPM global |
| **Rate Limit (LLM)** | facade | `langGraph/shared-tools/rate-limit.ts` | Bottleneck, 500 RPM global |
| **Pino logger** | telegram | `logger.ts` | Базовый (без requestId) |

### Что НЕ реализовано

| Компонент | Описание | Оценка |
|-----------|----------|--------|
| **Sentry** | Error monitoring + Telegram alerts | 1-2h |
| **Pino (facade)** | 24 console.* → structured logging | 2-3h |
| **Pino (shared)** | RequestId correlation между модулями | 1-2h |
| **LangSmith** | LLM cost tracking ($39/мес) | 1h setup |
| **Prometheus** | Metrics (Neo4j pool, cache hit rate) | 4-6h |
| **Grafana** | Dashboards | 2-3h |

### Зависимости (package.json)

| Пакет | Установлен |
|-------|------------|
| bottleneck | ✅ ^2.19.5 |
| pino | ✅ ^10.1.0 |
| pino-pretty | ✅ ^13.1.3 |
| @sentry/node | ❌ |
| prom-client | ❌ |
| langsmith | ❌ |

---

## Acceptance Criteria

### P0 (перед production)

- [ ] **4.2 Sentry**: Error tracking + Telegram alerts работают
- [ ] **4.3 Pino**: Facade использует structured logging (не console.*)

### P1 (первые недели production)

- [ ] **4.4 LangSmith**: LLM cost tracking настроен
- [ ] **4.3 Pino**: RequestId correlation между telegram и facade

### P2 (после стабилизации)

- [ ] **4.5 Prometheus**: Базовые метрики (request rate, latency)
- [ ] **4.6 Grafana**: Dashboard для мониторинга

---

## Решения

### Rate Limiting — DONE

**Telegram:** grammY `@grammyjs/ratelimiter` — per-user, 3 req/10s для heavy operations.

**Facade:** Bottleneck в `RateLimitedChatOpenAI` — global 500 RPM, 10 concurrent.

**Вывод:** Достаточно для MVP. Per-user limiting в Facade не нужен — Telegram уже ограничивает.

### LangSmith vs PostgreSQL

**Открытый вопрос.** Решить после первой недели production:
- Если ручной tracking >2h/week → LangSmith ($39)
- Если LLM costs >$50/month → LangSmith
- Иначе → PostgreSQL таблица `llm_calls`

---

## Связанные документы

- [MVP-RELEASE-PLAN.md](../../docs/mvp_final/MVP-RELEASE-PLAN.md) — Фаза 4
- [integrate-pino-logging.md](../../.claude/commands/integrate-pino-logging.md) — чеклист Pino

---

## Changelog

**2025-12-21:** Создан FEAT-030, зафиксировано текущее состояние
- Rate limiting: ✅ DONE (telegram + facade)
- Pino: ⚠️ Partial (только telegram)
- Sentry, LangSmith, Prometheus: ❌ не начато
