# WayMates — Контекст и Бэклог (Core)
_Обновлено: 2025-08-29 (NL→Cypher расширение)_

## 🎯 Каноника форматов
- Канонический формат данных: **JSON** (в БД — `jsonb` + нормализованные таблицы).
- **YAML** — только для человекочитаемых **политик/конфигов/промптов**; при записи конвертируем в JSON и валидируем AJV.
- **NDJSON** — **не используем** как источник истины.

## 🧭 Архитектура (ядро)
- **KAG-оркестратор** (LangGraph TS): ingest → parse → AJV → rules → **KAG-judge** → уточнения → human review → user confirm → queue → **DB-mapper** → Neo4j.
- **Neo4j**: единая БД (граф + вектора).  
  • Храним истории как узлы/связи.  
  • Эмбеддинги (BGE-m3) в Neo4j vector index (HNSW).  
  • Поиск = ANN (вектор) + Cypher-экспансия (граф).
- **GraphRAG**: гибридный поиск (top-K ANN + семантические связи).
- **NL→Cypher слой (новое):**
  - **Интерфейс `QueryToCypher`**: `generate({ nl, schema }) => { cypher, params, reasoning?, warnings? }`.
  - **Имплементации:**
    - **CustomNeo4jExamples** (дефолт): LLM JSON-mode/function-calling → **TypeBox/AJV** → **SafetyGuards** → **StaticChecks** (сверка со схемой) → `EXPLAIN` → `READ`-выполнение.
    - **LangChainAdapter** (опция): обёртка над GraphCypherQAChain, подключаемая через конфиг.
    - **LlamaIndexAdapter** (опция): обёртка над Text2Cypher/TextToCypherRetriever, подключаемая через конфиг.
  - **SchemaProvider**: интроспекция Neo4j (labels, relTypes, properties, индексы) → `GraphSchema` (JSON).
  - **PromptBuilder**: few-shot из `neo4j-labs/text2cypher` + доменная схема + наши правила.
  - **SafetyGuards (политика безопасности Cypher)**: белый список READ-клауз (`MATCH`, `OPTIONAL MATCH`, `WHERE`, `RETURN`, `WITH` без побочных эффектов, `ORDER BY`, `LIMIT`), запрет WRITE/мутаций (`CREATE`, `MERGE`, `DELETE`, `SET`, `REMOVE`, `LOAD CSV`, `CALL dbms.*` и др.), параметризация литералов, `LIMIT ≤ 100` (конфиг), таймауты.
  - **StaticChecks**: сверка labels/rel/properties с `GraphSchema`, запрет неизвестных узлов/полей/процедур, детект Cartesian Product (если не разрешено).
  - **Конфиг-переключатель**: `QUERY_TO_CYPHER_IMPL=custom|langchain|llamaindex`.
- **AJV + TypeBox**: строгая валидация JSON Schema (в т.ч. для NLU и NL→Cypher JSON-ответов).
- **Observability**: OpenTelemetry → Tempo (трейсы), Prometheus/Grafana (метрики), Sentry (ошибки).
  - **Новые спаны** для NL→Cypher: `build_prompt`, `llm_call`, `json_validate`, `guards_enforce`, `static_checks`, `dry_run_explain`, `neo4j_execute`, `post_answer_compose`.

## ✅ Принятые решения
1) **Валидация** — **AJV + TypeBox** (единая стратегия для NLU и NL→Cypher-ответов).
2) **NL→Cypher по умолчанию** — **CustomNeo4jExamples** (по материалам `neo4j-labs/text2cypher`) с жёсткой политикой безопасности.
3) **Плагины NL→Cypher** — через интерфейс `QueryToCypher` (адаптеры под LangChain и LlamaIndex подключаются конфигом).
4) **Деплой** — **GitHub Actions → SSH deploy** на VPS (`docker compose pull && up -d`).  
5) **Транскрибация** — **whisper.cpp** на MVP (WhisperX позже).  
6) **Эмбеддинги** — **BGE-m3 (small/base)** на старт; A/B с e5/stella позже.  
7) **Структура репо** — **monorepo**.  
8) **Proof-вложения и S3/MinIO** — позже.  
9) **Persist** — не сразу: AJV → rules → **KAG-judge** → **human** → **user** → очередь → **DB-mapper** → Neo4j.  
10) **Reverse-proxy** — **Caddy**.  
11) **Трейсинг** — **Tempo**; **Sentry** — bot/api/worker.

## 🧩 Процесс модерации (GitHub-админка)
**Артефакты истории** (до записи в БД):
```
stories/{story_id}/
  story.md        ← человекочитаемое представление
  story.json      ← канонический JSON по нашей схеме
  judge.json      ← { pass, score, reasons[], missing[] }
  transcript.txt  ← исходная транскрипция (опц.)
  meta.yaml       ← версии схем/DoD/язык/тайминги
```
Поток — как раньше (KAG-judge → PR → human → user → merge → DB-mapper).

## 🧪 Калибровка KAG-judge и NL→Cypher
- Малый оффлайн-набор NL↔Cypher кейсов (частично из `neo4j-labs/text2cypher`) для **few-shot** и **оценки**.
- Метрики NL→Cypher: **Valid JSON rate**, **Guard pass rate**, **EXPLAIN pass**, **Exec success**, **p95 latency**, **hallucination rate** (неизвестные сущности), **fallback rate**.

## 📦 Этапы MVP (актуальные)
- MVP-0: Голос → текст (whisper.cpp).
- MVP-1: NLU → черновой JSON → AJV → rules → **KAG-judge** → уточнения.
- MVP-2: **GitHub PR-модерация** (human) → **user confirm** (Telegram).
- MVP-3: Очередь → **DB-mapper** → Neo4j (узлы+связи+вектора).
- MVP-4: Поиск похожих историй (GraphRAG: ANN HNSW + Cypher-expansion).
- MVP-5: **NL→Cypher (Custom)** + конфиг-переключатель (интерфейс готов; адаптеры позже).
- MVP-6: Деплой на VPS; OTel (трейсы+метрики), **Sentry**.

## 📊 Ключевые метрики и риски
- **Latency ANN-поиска (p95, p99)**
- **% пустых/фолбэк запросов** (нет похожих историй)
- **Рост графа**: количество узлов/рёбер, размер индекса
- **Cost per query** (LLM токены + ANN вызовы + NL→Cypher)
- **User-facing latency** (бот → ответ)
- **Error rate** (Sentry)
- **Queue backlog**
- **NL→Cypher качество**: valid/guard/explain/exec rates, hallu rate, p95

