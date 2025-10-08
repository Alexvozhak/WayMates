# WayMates MCP Server - Трекер задач разработки

**Дата создания:** 2025-09-13  
**Последнее обновление:** 2025-09-13 (упрощение архитектуры)
**Основа:** [2025_09_13_mcp_server_prompt_tz.md](./2025_09_13_mcp_server_prompt_tz.md)  
**Цель:** MVP WayMates MCP Gateway для инжеста карьерных историй

**🔄 ИЗМЕНЕНИЯ:** Архитектура упрощена! Отказ от NestJS, SOLID, DI, интерфейсов в пользу простого Fastify + функций.

---

## 🏗️ **1. Настройка проекта и структуры**

### ✅ Архитектурные решения  
- [x] **Выбор технического стека** - ~~NestJS~~ **Fastify** + TypeScript + TypeBox + AJV + Pino (упрощено!)
- [x] **Определение архитектуры** - Gateway: WayMates MCP → mcp-neo4j → Neo4j  
- [x] **Создание технического задания** - ТЗ обновлено под простую архитектуру
- [x] **Environment variables** - определены все необходимые переменные

### 🔄 Инициализация проекта
- [x] **Создание отдельного репозитория** `waymates-mcp-server` 
- [ ] **package.json** - настройка с Fastify dependencies + ES modules  
- [ ] **tsconfig.json** - конфигурация для ES2022 + простые импорты
- [ ] **ESLint + Prettier** - качество кода + форматирование
- [ ] **Простая структура файлов (без сложной архитектуры)**
  ```
  src/
  ├── server.ts         # Основной Fastify сервер + роуты
  ├── schemas.ts        # TypeBox схемы
  ├── validators.ts     # Функции валидации (weak/strict)
  ├── normalizers.ts    # Функции нормализации 
  ├── persistence.ts    # Функции записи в Neo4j
  ├── neo4j-client.ts   # HTTP клиент для mcp-neo4j
  └── utils.ts          # Утилиты
  ```

---

## 🎯 **2. Простая функциональность (без модулей)**

### 🔍 Schemas & Validation  
- [ ] **TypeBox схемы** (в schemas.ts)
  - [ ] `StorySchema` - основная схема карьерной истории
  - [ ] `ContextSnapshotSchema` - схема контекста (FROM/TO)  
  - [ ] `SourceSchema` - схема источника данных
- [ ] **Функции валидации** (в validators.ts)
  - [ ] `validateStory(story, mode)` - простая функция валидации
  - [ ] `checkRequiredFields(story, mode)` - проверка обязательных полей
  - [ ] Логика weak/strict режимов
- [ ] **Тесты валидации** - unit тесты для функций

### 🤖 Normalization Functions
- [ ] **Функции нормализации** (в normalizers.ts)
  - [ ] `normalizeText(text, targetLang='en')` - OpenAI для перевода
  - [ ] `normalizeCurrency(amount, currency)` - конвертация в USD
  - [ ] `normalizeDate(dateText)` - парсинг дат из natural language
  - [ ] `convertCurrency(amount, fromCurrency, toCurrency)` - конвертация валют
  - [ ] Fallback логика если API недоступны
- [ ] **Тесты нормализации** - unit тесты с моками

### 💾 Persistence Functions
- [ ] **Neo4j клиент** (в neo4j-client.ts)
  - [ ] `addNode(name, type, observations)` - создание узла через mcp-neo4j
  - [ ] `addRelation(source, target, type)` - создание связи
  - [ ] `searchNodes(query)` - поиск для дедупликации
- [ ] **Функции персистенса** (в persistence.ts)
  - [ ] `persistStory(story)` - главная функция сохранения
  - [ ] `createStoryNodes(story)` - создание Story/Context/Source узлов
  - [ ] `createStoryRelations(story)` - создание связей FROM/TO/HAS_SOURCE
  - [ ] `checkDuplicates(story)` - проверка дубликатов
- [ ] **Тесты персистенса** - unit тесты с моками

---

## 🌐 **3. HTTP сервер и роуты**

### 📡 Fastify Server & Routes (в server.ts)
- [ ] **Fastify сервер setup** - с логированием и AJV валидацией
- [ ] **GET /mcp/tools** - MCP discovery endpoint
  - [ ] **JSON Schema generation** - из TypeBox в MCP format
  - [ ] **Tools definition** - validate, persist, clarify tools
- [ ] **MCP API endpoints**  
  - [ ] **POST /ingest/validate** - валидация с mode=weak|strict
  - [ ] **POST /ingest/persist** - полный пайплайн validate→normalize→save  
  - [ ] **POST /ingest/clarify** - возврат недостающих полей для доуточнения
- [ ] **Error handling** - машиночитаемые ошибки с request_id
- [ ] **TypeScript типы** - для request/response

### 🔒 Security & Middleware  
- [ ] **API Key authentication** - проверка API_KEYS из environment
- [ ] **Rate limiting** - @fastify/rate-limit для защиты от спама
- [ ] **Request logging** - встроенное Pino логирование
- [ ] **CORS configuration** - если планируется web UI  
- [ ] **Schema validation** - встроенная AJV валидация Fastify

---

## ⚙️ **4. Configuration & Infrastructure** 

### 🔧 Configuration (простая)
- [ ] **Environment переменные** - прямое использование process.env
- [ ] **Validation** - простая проверка обязательных переменных при старте
- [ ] **Environment files** - .env.example + README инструкции

### 📊 Logging & Monitoring
- [ ] **Pino Logger setup** - structured JSON логирование
- [ ] **Request correlation** - request_id для трассировки
- [ ] **Error logging** - детальное логирование ошибок  
- [ ] **Performance logging** - время выполнения операций
- [ ] **Health endpoints** - /health и /ready для мониторинга

---

## 🐳 **5. Containerization & Deployment**

### 📦 Docker Configuration  
- [ ] **Dockerfile** - оптимизированный для production
  - [ ] Multi-stage build для минимального размера
  - [ ] node:20-alpine базовый образ
  - [ ] Копирование только необходимых файлов
- [ ] **Docker Compose** - полная Gateway архитектура
  - [ ] waymates-mcp контейнер (публичный порт 8080)
  - [ ] mcp-neo4j контейнер (внутренний порт 8081)  
  - [ ] neo4j контейнер (внутренний порт 7687)
  - [ ] Изолированные сети (public/internal)
- [ ] **.dockerignore** - исключение ненужных файлов
- [ ] **Docker health checks** - проверка работоспособности контейнеров

### 🚀 CI/CD Pipeline
- [ ] **GitHub Actions workflow**
  - [ ] ESLint + TypeScript compilation на каждый push
  - [ ] Docker build & push в GHCR  
  - [ ] Автоматические теги по semantic versioning
- [ ] **GHCR setup** - приватный registry для Docker образов
- [ ] **Deployment инструкции** - README для IaaS деплоя

---

## 🧪 **6. Testing (После MVP review)**

### 🔬 Unit Tests
- [ ] **Validation tests** - тесты функций валидации + TypeBox схемы
- [ ] **Normalization tests** - тесты функций нормализации + моки API  
- [ ] **Persistence tests** - тесты функций персистенса + моки mcp-neo4j
- [ ] **HTTP endpoints tests** - тесты роутов Fastify через supertest
- [ ] **Utility functions tests** - тесты helper функций

### 🔗 Integration Tests  
- [ ] **End-to-end API tests** - полный пайплайн validate→persist
- [ ] **mcp-neo4j integration** - реальные HTTP вызовы к тестовой БД
- [ ] **Error scenarios** - тесты обработки ошибок
- [ ] **Rate limiting tests** - проверка защиты от спама

### ⚡ Performance Tests
- [ ] **Load testing** - нагрузочные тесты для критичных endpoints  
- [ ] **Memory profiling** - проверка утечек памяти
- [ ] **Response time SLA** - validate <500ms, persist <2000ms

---

## 📋 **7. Documentation & Polish**

### 📚 Documentation
- [ ] **README.md** - установка, запуск, конфигурация
- [ ] **API Documentation** - @nestjs/swagger для OpenAPI
- [ ] **Environment variables** - подробное описание всех переменных  
- [ ] **Deployment guide** - пошаговая инструкция для IaaS
- [ ] **Development setup** - инструкции для локальной разработки

### ✨ Code Quality  
- [ ] **ESLint fixes** - исправление всех линтер ошибок
- [ ] **Type coverage** - 100% TypeScript покрытие
- [ ] **Code review** - финальный обзор архитектуры и кода
- [ ] **Performance optimization** - оптимизация критичных участков

---

## 📊 **Прогресс выполнения**

### ✅ **Завершено (4/32)**
- [x] Архитектурные решения и техническое задание  
- [x] Выбор технического стека
- [x] Определение Gateway архитектуры
- [x] Детальная интеграция с mcp-neo4j

### 🔄 **В процессе (1/32)**  
- [ ] Инициализация проекта

### ⏳ **Ожидают выполнения (27/32)**
- Все остальные задачи из списка выше

---

## 📝 **Заметки по разработке**

### 🎯 Приоритеты MVP
1. **Критичный путь:** Validation → Normalization → Persistence → MCP API
2. **Архитектура:** Интерфейсы для всей бизнес-логики (SOLID принципы)
3. **Quality:** ESLint проверки + коммиты после важных вех
4. **Testing:** После MVP review, фокус на критичные компоненты

### 🔍 Context7 Usage  
- Использовать для MCP protocol best practices
- TypeScript MCP implementation patterns  
- NestJS + MCP integration примеры
- mcp-neo4j API reference

### 📋 Commit Strategy
- Коммиты после завершения каждого крупного модуля
- Описательные сообщения с архитектурными решениями  
- Регулярные ESLint + TypeScript проверки
- Объяснение применения SOLID принципов

---

**Последнее обновление:** 2025-09-13  
**Статус:** Готов к началу разработки 🚀
