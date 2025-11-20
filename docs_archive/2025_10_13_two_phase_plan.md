# Двухфазная реализация проекта WayMatesRemote

Этот документ описывает поэтапный план внедрения архитектуры фасада и ядра.

## Фаза 1: Быстрый MVP

**Цель:** максимально быстро запустить Core MCP и MCPO без публикации исходников.

### Phase 1: Core vs Facade
#### Core MCP (`src/mcp-server.ts`, порт 9000)
  - Реализует инструменты через `tool(name, schema, handler)`
  - Принимает JSON-RPC вызовы (`/mcp`)
  - Содержит бизнес-логику, запросы Cypher и Zod-схемы
  - Не публикуется: код и схемы в приватном репо

#### Facade MCPO-REST (`src/mcpo-server.ts`, порт 8080)
  - Аутентификация и rate-limit: проверка X-API-Token → user_id (SQLite + KeyDB + `@fastify/rate-limit`)
  - Принимает REST-запросы на `/v1/tools/<tool>`
  - Валидирует JSON через Zod
  - Проксирует вызовы в Core MCP с помощью `FastMCPClient.call`
  - Клиентам (ChatGPT/LibreChat) нужен только REST text→JSON

- **ChatGPT / LibreChat**:
  - Подключается по REST (`/v1/tools`) и должен самостоятельно делать text→JSON через системный промпт

**Плюсы:**
- Минимальные изменения в Core
- Быстрый запуск
- Нет публикации исходников Core

**Минусы:**
- Клиентам нужно знать JSON-схемы
- Нет text-chat интерфейса

## Фаза 2: Полноценный Facade-Gateway и скрытие Core

**Цель:** предоставить единый клиентский интерфейс (REST + JSON-RPC + text-chat) и скрыть реализацию Core.

### Phase 2: Core vs Facade
#### Core MCP (`@yourorg/core`, порт 9000)
  - Упакован в приватный npm-пакет
  - Содержит `src/mcp-server.ts`, `search-manager`, `.cypher` и Zod-схемы
  - Предоставляет только JSON-RPC интерфейс для инструментов (`/mcp`)
  - Не знает про REST или LLM

#### Facade-Gateway (`@yourorg/facade`, порт 8080)
  - Публичный npm-пакет и HTTP-сервер Fastify
  - **Маршруты:**
    - `/mcp/*` — проксирует JSON-RPC вызовы в Core MCP
    - `/v1/actions/<tool>` — MCPO-REST: валидирует и проксирует в Core
    - `/chat/<tool>` — текстовый чат: LLM-пре- и пост-обработка вокруг Core RPC
  - **Auth & Rate-Limit:** X-API-Token → SQLite+KeyDB
  - **Скрытие Core:** не содержит Cypher и схемы, импортирует только `toolNames`
  - **Преимущества:** единая точка входа, гибкий UX, полная инкапсуляция бизнес-логики

**Преимущества:**
- **Единая точка входа**: порт 8080, клиенту не нужны два порта
- **Скрытие схем и Cypher**: Core остаётся полностью закрытым
- **Гибкий UX**: поддержка raw text, JSON-RPC и REST
- **Простота тестирования**: facade и core тестируются отдельно

**Итоги:**
- Phase 1 — MVP без публикации кода, JSON-интеграция
- Phase 2 — Facade-Gateway, текстовый и JSON-интерфейс, private npm-core

*Дата: 2025-10-13*
