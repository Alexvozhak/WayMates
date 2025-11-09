## Промпт-ТЗ: Реализовать MCP Ingest Server (MVP) для WayMates

Дата: 2025-09-13

> **Отложено:** не входит в минимальный план. Реализуем в следующей итерации после локальных скриптов.

### 0) Контекст и цель
- Проект: WayMates (карьерная аналитика). Архитектура MVP: IaaS + n8n + Telegram Bot + AI‑агент + Neo4j DB.
- Нужен **WayMates MCP Gateway** — единая точка входа для всех данных в систему.
- Он принимает данные от n8n/интеграций, валидирует по JSON‑схеме (режимы weak|strict), нормализует (EN/ISO/USD), и записывает в Neo4j, выдаёт машиночитаемые ошибки и «clarify»‑подсказки.
- **Архитектурный принцип:** Все данные идут через WayMates MCP → никто не может обойти нашу бизнес-логику и validation.
Мы (как разработчики) можем самостоятельно добавлять автоматизированный скрабинг сайтов или импорт архивных статей/историй, если они подходят по сути (решение принимает разработчик платформы).

### 1) Технический стек (обязателен)
- **Node.js 22+** с ES модулями (`"type": "module"` в package.json).
- **TypeScript** — строгая типизация + компиляция в ES2022.
- **Fastify** (HTTP‑сервер) — простой, быстрый, минималистичный подход.
- **TypeBox** (@sinclair/typebox) для типобезопасных схем + генерация JSON Schema.
- **AJV v8** для валидации через встроенный Fastify validator.
- **neo4j-driver** — официальный Neo4j JavaScript драйвер для прямого доступа к базе данных.
- **OpenAI API** — для нормализации текста в EN и валютной конвертации.
- **Pino** — structured JSON логирование (встроенный в Fastify).
- **Простая архитектура**: один server.ts + функции вместо классов и интерфейсов.
- **KISS, DRY, YAGNI принципы** — максимально простая реализация для MVP.


### 2) Эндпоинты (tools) и discovery
- GET `/mcp/tools` — discovery: вернуть список инструментов с именем, описанием и inputSchema.
  - Верните массив tools по образцу MCP JSON. Пример структуры см. memory-bank/schemas.md.
- POST `/ingest/validate?mode=weak|strict`
  - Вход: JSON payload истории.
  - Действия: (1) AJV по базовой схеме; (2) пост‑проверка обязательных полей по режиму.
  - Выход: { ok: true } или { error: { code, message, details, missing_fields[] } } со статусами 400/422.
    - Внешний источник (API/скрейпинг): validate(mode=weak) → persist.
    - Telegram: validate(mode=strict) → при ошибках вызвать clarify → persist.
- POST `/ingest/persist`
  - Вход: JSON payload истории (после успешной validate).
  - Действия: нормализация (EN/ISO/USD), идемпотентная запись в Neo4j, дедуп.
  - Выход: { ok: true, ids: { story_id, snapshot_ids[], resource_ids[] } } или машиночитаемая ошибка. Для дублей допустим 409.
- POST `/ingest/clarify`
  - Вход: payload истории.
  - Выход: { questions: [{path, question, example?}], missing_fields: [] } — готовые «что спросить» для Telegram.
**Основные коды ошибок для MVP:**
- **400** `VALIDATION_ERROR` — AJV схема не прошла (неверный тип поля, формат)
- **422** `MISSING_FIELDS` — пост-валидация mode=strict/weak, отсутствуют required поля  
- **409** `DUPLICATE` — дубликат при /persist по source.url или story_id
- **500** `DATABASE_ERROR` — ошибка записи в Neo4j, откат транзакции

размер payload, rate limit (Fastify plugin), таймауты. нужны лимиты для пользователей, чтобы не сожрали все токены и замусорили всё S3 хранилище исходными данными






## Форматы ответов Gateway (MVP)

### Общий формат ошибки
```json
{
  "error": {
    "code": "MISSING_FIELDS",
    "message": "Required fields missing for strict mode",
    "missing_fields": ["/contexts/0/role", "/contexts/0/tech/languages"],
    "details": null
  },
  "request_id": "req_12345"
}
```

- code: один из VALIDATION_ERROR | MISSING_FIELDS | DUPLICATE | DATABASE_ERROR
- missing_fields: массив путей (желательно JSON Pointer) к отсутствующим/некорректным полям
- details: объект с дополнительной диагностикой (если есть)
- request_id: трейс для корреляции логов

### /ingest/validate
- Успех:
```json
{ "ok": true, "request_id": "req_12345" }
```
- Ошибка схемы (400 VALIDATION_ERROR): общий формат ошибки (см. выше)
- Недостаточно полей (422 MISSING_FIELDS): общий формат ошибки (см. выше)

### /ingest/persist
- Успех:
```json
{
  "ok": true,
  "ids": {
    "story_id": "ms1",
    "snapshot_ids": ["ctx1","ctx2"],
    "resource_ids": []
  },
  "request_id": "req_12345"
}
```
- Дубликат (409 DUPLICATE): общий формат ошибки
- Ошибка БД (500 DATABASE_ERROR): общий формат ошибки

### /ingest/clarify
- Успех:
```json
{
  "questions": [
    {
      "path": "/contexts/0/role",
      "question": "Уточните текущую роль",
      "example": "Senior Software Developer"
    }
  ],
  "missing_fields": ["/contexts/0/role"],
  "request_id": "req_12345"
}
```
- Ошибка входа (400 VALIDATION_ERROR): общий формат ошибки

