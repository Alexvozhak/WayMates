# WayMates — План запуска (Roadmap)
_Обновлено: 2025-08-29 (NL→Cypher расширение)_
Расчёт: один разработчик, ~8 ч/день. Язык — **TypeScript**. Репозиторий — **GitHub (monorepo)**.

## 🔑 Блокеры (резюме)
- AJV+TypeBox — принято.  whisper.cpp — принято.  BGE‑m3 — принято.
- Деплой: GitHub Actions → SSH — принято.  Caddy — принято.
- Tempo + Prometheus/Grafana — принято.  **Sentry** — принято.
- Proof‑вложения + S3/MinIO — позже.
- **NL→Cypher**: интерфейс `QueryToCypher` — принято; дефолт **CustomNeo4jExamples** — принято; адаптеры LangChain/LlamaIndex — позже.

## 📅 План по дням (10 рабочих дней)

**День 1 — Репо и каркас**
- Monorepo (pnpm workspaces): `apps/bot`, `apps/api`, `apps/worker`, `packages/core`, `packages/db-mapper`, `packages/query-to-cypher`, `infra`.
- ESLint/Prettier/tsconfig, pre-commit. Базовые `.env.example`.

**День 2 — Инфра локально**
- `docker-compose.yml`: Neo4j (граф + vector index HNSW), api, bot, worker, caddy (локально без TLS).
- Makefile: init Neo4j (схема + индексы HNSW).

**День 3 — Схема/валидация**
- TypeBox: `story.schema.ts` v1 → генерация JSON Schema.
- AJV‑тесты: валид/невалид кейсы.

**День 4 — Бот и медиа‑поток**
- Telegraf: /start, /help, приём voice/doc.  ffmpeg: ogg→wav.

**День 5 — Транскрибация**
- Интеграция whisper.cpp (CLI wrapper).  Юнит на поток voice→текст.

**День 6 — NLU → JSON**
- Правила/шаблоны маппинга → черновой JSON.  AJV → список недостающих полей.

**День 7 — KAG‑judge + уточнения**
- Rules + LLM (structured output `{pass,score,missing}`), политика принятия.
- Генерация уточняющих вопросов.

**День 8 — GitHub PR‑модерация**
- Генерация артефактов `stories/{id}/story.md|json|judge.json`.
- Автосоздание PR c labels (`needs-human`) и чеклистом.
- CI: при `approved-human` — отправка `story.md` пользователю в Telegram (кнопки «Подтверждаю/Исправить»).

**День 9 — DB‑mapper и поиск**
- DB‑mapper пишет JSON в Neo4j (узлы/связи + эмбеддинги).
- Эмбеддинги BGE‑m3 → Neo4j vector index (HNSW).
- Поиск: гибридный GraphRAG (ANN + Cypher-expansion).
- Ответ в Markdown пользователю.

**День 10 — NL→Cypher (Custom) + Observability**
- Пакет `packages/query-to-cypher` с интерфейсом `QueryToCypher`.
- **CustomNeo4jExamples**: SchemaProvider (интроспекция), PromptBuilder (few-shot из `neo4j-labs/text2cypher`), LLM JSON-mode/function-calling, **AJV** валидация, **SafetyGuards**, **StaticChecks**, `EXPLAIN` + READ-выполнение.
- Конфиг `QUERY_TO_CYPHER_IMPL=custom|langchain|llamaindex`.
- OTel спаны: `build_prompt`, `llm_call`, `json_validate`, `guards_enforce`, `static_checks`, `dry_run_explain`, `neo4j_execute`.
- Метрики/алерты для NL→Cypher.

## 🧪 Тесты и бенчмарки
- Набор NL↔Cypher кейсов (часть из `neo4j-labs/text2cypher`): unit/it тесты.
- Метрики: Valid JSON, Guard pass, EXPLAIN pass, Exec success, p95 latency, hallucination rate, cost/query.
- Снапшоты промптов; регрессия на изменениях схемы.

## 🔁 Later (после MVP)
- **Адаптеры**: `LangChainAdapter` и `LlamaIndexAdapter` к `QueryToCypher` + конфиг‑переключение.
- **A/B**: сравнение Custom vs LangChain vs LlamaIndex по качеству/латентности/стоимости.
- **Файнтюн**: дообучение доменной модели на наших кейсах (используя датасеты из `neo4j-labs/text2cypher`).
- Proof‑вложения + S3/MinIO; PII‑редакция (OpenCV/PDF).
- Расширенный лог‑стек (Loki), детальные алерты и SLO.
- Мониторинг ключевых метрик (добавить NL→Cypher раздел).

