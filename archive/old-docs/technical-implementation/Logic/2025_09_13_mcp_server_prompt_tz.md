## Промпт-ТЗ: Реализовать MCP Ingest Server (MVP) для WayMates

Дата: 2025-09-13

### 0) Контекст и цель
- Проект: WayMates (карьерная аналитика). Архитектура MVP: IaaS + n8n + Telegram Bot + AI‑агент + Neo4j DB.
- Нужен **WayMates MCP Gateway** — единая точка входа для всех данных в систему.
- Он принимает данные от n8n/интеграций, валидирует по JSON‑схеме (режимы weak|strict), нормализует (EN/ISO/USD), и записывает в Neo4j **напрямую через neo4j-driver**, выдаёт машиночитаемые ошибки и «clarify»‑подсказки.
- **Архитектурный принцип:** Все данные идут через WayMates MCP → никто не может обойти нашу бизнес-логику и validation.

Опора на MCP‑подход (tools + discovery + строгие контракты). Релевантные материалы (для мышления, не обязательно копировать):
- Список tools в формате MCP (JSON пример выдачи): «JSON output of listed MCP tools» [`/microsoft/mcp-for-beginners`](https://github.com/microsoft/mcp-for-beginners/blob/main/translations/br/03-GettingStarted/01-first-server/solution/python/README.md#_snippet_6)
- Best practices и е2е‑тесты MCP серверов [`/microsoft/mcp-for-beginners`](https://github.com/microsoft/mcp-for-beginners)
- Security заметки для HTTP MCP (Origin, CORS, HTTPS, Auth) [`/microsoft/mcp-for-beginners`](https://github.com/microsoft/mcp-for-beginners/blob/main/translations/es/03-GettingStarted/06-http-streaming/README.md#_snippet_3)

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
  - Верните массив tools по образцу MCP JSON (name, description, inputSchema). Пример структуры см. «JSON output of listed MCP tools» (ссылка выше).
- POST `/ingest/validate?mode=weak|strict`
  - Вход: JSON payload истории.
  - Действия: (1) AJV по базовой схеме; (2) пост‑проверка обязательных полей по режиму.
  - Выход: { ok: true } или { error: { code, message, details, missing_fields[] } } со статусами 400/422.
- POST `/ingest/persist`
  - Вход: JSON payload истории (после успешной validate).
  - Действия: нормализация (EN/ISO/USD), идемпотентная запись в Neo4j, дедуп.
  - Выход: { ok: true, ids: { story_id, snapshot_ids[], resource_ids[] } } или машиночитаемая ошибка. Для дублей допустим 409.
- POST `/ingest/clarify`
  - Вход: payload истории.
  - Выход: { questions: [{path, question, example?}], missing_fields: [] } — готовые «что спросить» для Telegram.

Примечание: сервер не рендерит HTML, только JSON. Content‑Type: application/json.

### 3) Схемы данных (база)
- Базовая JSON‑схема максимально опциональна (валидируем типы/форматы, но почти без required).
- Режимы строгости (weak/strict) задаются параметром `mode` в validate и реализуются пост‑проверкой:
  - Weak (внешние источники): требуем `source.system`, `source.channel`, одно из `source.url|source.external_id`, `source.fetched_at` (ISO‑datetime). `raw_text`, `lang` — опциональные (если есть).
  - Strict (Telegram/ручной ввод): требуем `story.period.start_date`, `story.period.end_date`, `story.hours_total`, `story.rating_1_5`, `story.from_snapshot_id`, `story.to_snapshot_id`.
- Справочник полей, которые возможны в payload:
  - `source`: { system, channel, url?, external_id?, fetched_at }
  - `raw_text`?, `lang`? — опциональные для всех режимов
  - `story`: {
    status, period: { start_date, end_date, granularity?, approx? },
    hours_total?, rating_1_5?, recommend?, from_snapshot_id?, to_snapshot_id?
  }
  - `context`?: { snapshot_id, user_id, signature_text, language?, timezone? }

Политика recommend/rating:
- В strict требуем только `rating_1_5`. `recommend` опционален; в UI можно выводить derived‑флаг (rating_1_5 ≥ 4) отдельно от явного.

### 4) Нормализация внутри /persist
- **Язык → EN канон:** `signature_text` нормализуется через OpenAI API (оригинал `raw_text`/`lang` сохраняется).
- **Валюта → USD (эволюционный подход):** 
  - MVP: OpenAI парсит сложные форматы → Exchange API конвертирует по текущему курсу
  - Сохраняем оригинальные данные (amount, currency, raw_text) + метаданные конвертации
  - Флаг `conversion_type: "current"` для будущей migration на исторические курсы
  - v2: скрипт пересчета через исторические API на дату события
- **Даты → ISO‑формат:** заполняем `granularity` (day|month|year); проставляем `approx=true`, если извлечение приблизительное.
- **Entity Mapping:** Story/ContextSnapshot/Source преобразуются в Neo4j узлы и связи через прямые Cypher запросы.
- **URL канонизация:** `CourseResource.url_canonical` очищается от UTM/referral параметров.
- **Embeddings (в будущем):** Генерация векторов для ContextSnapshot‑ов запланирована на v2.
- **Никаких «догадок»:** если поле не извлекается — пропускаем.

### 5) Прямая интеграция с Neo4j (через neo4j-driver)
**Архитектурный принцип:** WayMates MCP → neo4j-driver → Neo4j

**Упрощенный подход MVP:**
- Прямые Cypher запросы через `driver.executeQuery()` и транзакции
- Один `createStoryGraph()` вызов создает весь граф истории за одну транзакцию
- Значительно быстрее и проще чем HTTP обертки
- Полная типизация TypeScript + автокомплит IDE

**Пример создания Story графа:**
```typescript
// Все в одной транзакции - атомарность гарантирована
const storyData = {
  story_id: 'story_12345',
  story_text: 'Переход в Data Science за 6 месяцев',
  source_system: 'telegram',
  source_url: 'https://t.me/waymates/123',
  contexts: [{
    id: 'ctx_from_456',
    type: 'from',
    text: 'Junior Developer, PHP, 2 года опыта'
  }],
  resources: [{
    id: 'res_789', 
    title: 'Python for Data Science',
    url: 'https://coursera.org/learn/python-data-science'
  }],
  rating: 5,
  cost: { amount: 2500, currency: 'USD' }
}

// Один вызов = весь граф
await createStoryGraph(storyData)
```

**Cypher queries генерируются автоматически:**
```cypher
-- Source узел
MERGE (source:Source {id: $sourceId})
SET source.system = $system, source.url = $url

-- Story узел  
MERGE (story:Story {id: $storyId})
SET story.signature_text = $text, story.rating = $rating

-- Context узел
MERGE (ctx:ContextSnapshot {id: $contextId})
SET ctx.signature_text = $text, ctx.type = $type

-- Связи
MATCH (story:Story {id: $storyId}), (source:Source {id: $sourceId})
MERGE (story)-[:HAS_SOURCE]->(source)
```

**Преимущества прямого драйвера:**
- 🚀 **Производительность:** один network call вместо множественных HTTP запросов
- 🔧 **Простота:** стандартный JavaScript/TypeScript workflow  
- 🐛 **Отладка:** прямые ошибки Neo4j без промежуточных слоев
- 💪 **Гибкость:** любые Cypher запросы, включая сложные аналитические
- 📦 **Меньше зависимостей:** только neo4j-driver

### 6) Ошибки и статусы (MVP)
**Основные коды ошибок для MVP:**
- **400** `VALIDATION_ERROR` — AJV схема не прошла (неверный тип поля, формат)
- **422** `MISSING_FIELDS` — пост-валидация mode=strict/weak, отсутствуют required поля  
- **409** `DUPLICATE` — дубликат при /persist по source.url или story_id
- **500** `DATABASE_ERROR` — ошибка записи в Neo4j, откат транзакции

**Формат ответа:**
```json
{
  "error": {
    "code": "MISSING_FIELDS",
    "message": "Required fields missing for strict mode", 
    "missing_fields": ["story.rating_1_5", "story.hours_total"],
    "request_id": "req_12345"
  }
}
```

**Опционально (для production):**
- 401 AUTH_ERROR, 429 RATE_LIMIT — добавляем при необходимости
- Всегда возвращать `request_id` (генерировать, если не пришёл).

### 7) Безопасность и эксплуатация
- Dev: bind на localhost; Prod: HTTPS, API key/bearer‑token, CORS по allowlist, Origin‑check.
- Лимиты: размер payload, rate limit (Fastify plugin), таймауты.
- Логи/метрики: запросы, коды, тайминги; `X-Schema-Version` в ответах validate.
- Трассировка: `request_id` в логах и ответах.

### 8) Документация/Discovery
- GET `/mcp/tools` → JSON со списком tools и их inputSchema (см. пример структуры в MCP «JSON output of listed MCP tools»).
- Если подключён Swagger: GET `/docs` в dev, спрятать в prod.

### 9) Сценарии использования (n8n)
- Внешний источник (API/скрейпинг): validate(mode=weak) → persist.
- Telegram: validate(mode=strict) → при ошибках вызвать clarify → persist.

### 10) Примеры
Пример discovery `/mcp/tools` (структура по MCP):
```json
{
  "tools": [
    {
      "name": "ingest.validate",
      "description": "Валидация истории (weak|strict)",
      "inputSchema": {
        "type": "object",
        "properties": {
          "mode": {"type": "string", "enum": ["weak", "strict"]},
          "payload": {"type": "object"}
        },
        "required": ["mode", "payload"],
        "title": "ingestValidateArgs"
      }
    },
    {
      "name": "ingest.persist",
      "description": "Нормализация и запись в Neo4j",
      "inputSchema": {
        "type": "object",
        "properties": {"payload": {"type": "object"}},
        "required": ["payload"],
        "title": "ingestPersistArgs"
      }
    },
    {
      "name": "ingest.clarify",
      "description": "Сформировать недостающие поля и вопросы для доуточнения",
      "inputSchema": {
        "type": "object",
        "properties": {"payload": {"type": "object"}},
        "required": ["payload"],
        "title": "ingestClarifyArgs"
      }
    }
  ]
}
```

Пример cURL:
```bash
curl -X POST "http://localhost:8080/ingest/validate?mode=weak" \
  -H "Content-Type: application/json" \
  -d '{
    "source": {"system":"pushshift","channel":"api","url":"https://reddit.com/...","fetched_at":"2025-09-13T10:00:00Z"},
    "raw_text":"Got a promotion...","lang":"en",
    "story": {"status":"draft"}
  }'
```

### 11) Тесты (минимум)
- Юнит: пост‑проверка required для weak/strict.
- Интеграция: validate→persist→проверка записи в Neo4j; дубль → 409.
- Контрактные: GET /mcp/tools структура соответствует MCP примеру; все tools возвращают машиночитаемые ошибки.

### 12) Environment Variables (абстрактные названия)
```env
# AI Service (OpenAI, Claude, или другой)
AI_API_KEY=sk-proj-...
AI_MODEL=gpt-4o-mini
AI_PROVIDER=openai

# Neo4j Database (прямое подключение)
NEO4J_URI=bolt://neo4j:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your-neo4j-password
NEO4J_DATABASE=waymates

# Currency API (эволюционный подход)
EXCHANGE_RATES_API_KEY=your-key-or-free
EXCHANGE_RATES_PROVIDER=exchangerate-api.com
CONVERSION_MODE=current  # current (MVP) | historical (v2)

# Security & Auth
API_KEYS=n8n:secret123,webapp:secret456
JWT_SECRET=your-jwt-secret

# Service Config
PORT=8080
NODE_ENV=production
LOG_LEVEL=info
```

### 13) Deployment (Упрощенная архитектура)
**Принцип:** WayMates MCP как единая точка входа, прямое подключение к Neo4j.

- **WayMates MCP:** Публичный доступ на порту 8080
- **Neo4j:** Внутренний доступ, только для WayMates MCP

### 16) Конфигурация проекта (ES модули + TypeScript)

**package.json основные поля:**
```json
{
  "name": "waymates-mcp-server",
  "version": "1.0.0",
  "type": "module",
  "engines": { "node": ">=18.0.0" },
  "scripts": {
    "dev": "tsx watch src/main.ts",
    "build": "nest build",
    "start": "node dist/main.js", 
    "start:dev": "nest start --watch",
    "test": "vitest",
    "lint": "eslint src --ext .ts",
    "lint:fix": "eslint src --ext .ts --fix"
  },
  "dependencies": {
    "fastify": "^4.24.0",
    "@fastify/cors": "^8.4.0",
    "@fastify/rate-limit": "^8.0.0",
    "@fastify/env": "^4.2.0",
    "@sinclair/typebox": "^0.31.0",
    "pino": "^8.15.0",
    "pino-pretty": "^10.2.0",
    "axios": "^1.6.0"
  },
  "devDependencies": {
    "typescript": "^5.2.0",
    "tsx": "^4.0.0",
    "vitest": "^0.34.0",
    "@types/node": "^20.8.0"
  }
}
```

**Простая структура проекта:**
```
src/
  server.ts           # Основной Fastify сервер
  schemas.ts          # TypeBox схемы для валидации
  validators.ts       # Функции валидации (weak/strict)
  normalizers.ts      # Функции нормализации (AI, валюты)
  persistence.ts      # Функции записи в Neo4j
  neo4j-client.ts     # HTTP клиент для mcp-neo4j
  utils.ts           # Утилиты и helper функции
```

**Упрощенная архитектура (простые функции):**
```typescript
// src/neo4j-client.ts
import axios from 'axios'

const NEO4J_MCP_URL = process.env.NEO4J_MCP_URL || 'http://mcp-neo4j:8081'

export async function addNode(name: string, type: string, observations: string[]): Promise<void> {
  const response = await axios.post(`${NEO4J_MCP_URL}/api/mcp/`, {
    method: 'tools/call',
    params: {
      name: 'add_node',
      arguments: { name, type, observations }
    }
  })
  
  if (!response.data.result?.success) {
    throw new Error(`Neo4j node creation failed: ${response.data.error}`)
  }
}

// src/persistence.ts
import { addNode } from './neo4j-client.js'
import type { NormalizedStory } from './types.js'

export async function persistStory(story: NormalizedStory): Promise<{ success: boolean, story_id: string }> {
  // 1. Создать Story node
  await addNode(
    `story_${story.story_id}`,
    'Story',
    [
      `Signature: ${story.signature_text}`,
      `Duration: ${story.duration_months} months`,
      `Cost: $${story.cost_total.amount} USD`
    ]
  )

  // 2. Создать Context nodes и Relations (упрощено)
  return { success: true, story_id: story.story_id }
}
```

**tsconfig.json для ES модулей:**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022", 
    "moduleResolution": "Node",
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "baseUrl": "./src",
    "paths": {
      "@/*": ["*"],
      "@/types/*": ["types/*"],
      "@/services/*": ["services/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

**Пример простого Fastify сервера:**
```typescript
// src/server.ts - основной файл сервера
import fastify from 'fastify'
import { Type } from '@sinclair/typebox'
import { validateStory, persistStory } from './validators.js'
import { StorySchema } from './schemas.js'

// Создаем Fastify сервер с логированием
const server = fastify({ 
  logger: { level: process.env.LOG_LEVEL || 'info' },
  ajv: { removeAdditional: true }
})

// MCP Tools Discovery endpoint
server.get('/mcp/tools', async () => {
  return {
    tools: [
      {
        name: 'ingest_validate',
        description: 'Validate career story data using weak or strict modes',
        inputSchema: StorySchema
      },
      {
        name: 'ingest_persist', 
        description: 'Full pipeline: validate, normalize and persist story',
        inputSchema: StorySchema
      }
    ]
  }
})

// Story validation endpoint
server.post('/ingest/validate', {
  schema: {
    querystring: Type.Object({
      mode: Type.Optional(Type.Union([Type.Literal('weak'), Type.Literal('strict')]))
    }),
    body: StorySchema
  }
}, async (request) => {
  const { mode = 'weak' } = request.query
  return await validateStory(request.body, mode)
})

// Story persistence endpoint
server.post('/ingest/persist', {
  schema: {
    querystring: Type.Object({
      mode: Type.Optional(Type.Union([Type.Literal('weak'), Type.Literal('strict')]))
    }),
    body: StorySchema
  }
}, async (request) => {
  const { mode = 'weak' } = request.query
  return await persistStory(request.body, mode)
})

// Start server
const start = async () => {
  try {
    await server.listen({ port: 8080, host: '0.0.0.0' })
    server.log.info('🚀 WayMates MCP Server running on http://0.0.0.0:8080')
  } catch (err) {
    server.log.error(err)
    process.exit(1)
  }
}

start()
```

- NPM scripts: dev (tsx watch src/server.ts), build (tsc), start (node dist/server.js), test (vitest).

### 17) Критерии готовности (Definition of Done)
**WayMates MCP Gateway функциональность:**
- ✅ Все три эндпоинта работают: `/mcp/tools`, `/ingest/validate`, `/ingest/persist`, `/ingest/clarify`
- ✅ Валидация поддерживает режимы weak/strict с правильными required полями
- ✅ Нормализация EN/USD через AI API работает корректно
- ✅ Интеграция с mcp-neo4j: Entity/Relation маппинг + HTTP вызовы
- ✅ Машиночитаемые ошибки, request_id, audit logs, API key аутентификация
- ✅ Дедуп работает через search_nodes в mcp-neo4j

**Deployment и инфраструктура:**
- ✅ Docker Compose с Gateway архитектурой (waymates-mcp + mcp-neo4j + neo4j)
- ✅ Изолированные сети: публичный доступ только к WayMates MCP
- ✅ Environment variables с абстрактными названиями (AI_API_KEY, NEO4J_MCP_URL)
- ✅ Примеры cURL из ТЗ проходят через Gateway

---

Ссылки (для разработчика):
- Пример JSON списка tools (MCP): «JSON output of listed MCP tools» [`/microsoft/mcp-for-beginners`](https://github.com/microsoft/mcp-for-beginners/blob/main/translations/br/03-GettingStarted/01-first-server/solution/python/README.md#_snippet_6)
- Best practices / e2e тесты MCP серверов (TS/Java/Python) — тот же репозиторий.
- Security заметки для HTTP MCP: Origin/CORS/HTTPS/Auth — см. раздел «Key Security Considerations...» в MCP for Beginners.

### 18) Деплой как приватный Docker‑образ (GHCR пример)

#### 18.1 Dockerfile (минимальный шаблон)
```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .

# Если есть этап сборки TypeScript → раскомментируйте:
# RUN npm ci && npm run build && rm -rf node_modules && npm ci --only=production

FROM node:20-alpine
WORKDIR /app
COPY --from=build /app /app

# Порт сервиса
ENV PORT=8080

# Переменные MCP/Neo4j (переопределяются на IaaS через .env/секреты)
ENV NEO4J_URI=""
ENV NEO4J_USER=""
ENV NEO4J_PASSWORD=""
ENV SCHEMA_DIR=""

EXPOSE 8080
CMD ["server.js"]
```

Примечания:
- Если проект на TypeScript, добавьте `npm run build` и запускайте `dist/server.js`.
- Используем `node:20-alpine` для простоты отладки MVP. В будущем можно перейти на distroless.

#### 18.2 GitHub Actions → GHCR (приватный реестр)
```yaml
name: ci-mcp
on:
  push:
    branches: [ main ]

jobs:
  docker:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - name: Set up QEMU
        uses: docker/setup-qemu-action@v3
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
      - name: Login to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: |
            ghcr.io/${{ github.repository }}:latest
            ghcr.io/${{ github.repository }}:${{ github.sha }}
```

После первого пуша зайдите в GHCR и переключите видимость пакета на private (по умолчанию private, проверьте).

#### 18.3 Что сделать мне (ручной запуск на IaaS)
1) Войти в приватный реестр GHCR:
```bash
echo <GHCR_PAT> | docker login ghcr.io -u <GH_USERNAME> --password-stdin
```
2) Создать файл `.env` рядом с docker‑командой:
```env
PORT=8080
NEO4J_URI=neo4j://<host>:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=******
# Опционально: если хотите переопределить схемы с диска
# SCHEMA_DIR=/opt/mcp/schemas
```
3) Запустить контейнер напрямую:
```bash
docker pull ghcr.io/<org>/<repo>:latest
docker run -d --name waymates-mcp \
  --env-file .env \
  -p 8080:8080 \
  -v /opt/mcp/schemas:/opt/mcp/schemas:ro \
  ghcr.io/<org>/<repo>:latest
```
4) Проверить, что сервис отвечает:
```bash
curl -s http://localhost:8080/mcp/tools | jq
```

#### 18.4 Docker Compose (Gateway архитектура)
```yaml
services:
  waymates-mcp:
    build: .
    container_name: waymates-mcp-gateway
    restart: unless-stopped
    ports:
      - "8080:8080"  # Публичный API Gateway
    environment:
      - AI_API_KEY=${AI_API_KEY}
      - AI_MODEL=gpt-4o-mini
      - NEO4J_MCP_URL=http://mcp-neo4j:8081
      - API_KEYS=${API_KEYS}
      - JWT_SECRET=${JWT_SECRET}
    networks: [public, internal]
    depends_on: [mcp-neo4j]

  mcp-neo4j:
    image: mcp/neo4j-cypher:latest
    container_name: mcp-neo4j-server
    restart: unless-stopped
    environment:
      - NEO4J_URI=bolt://neo4j:7687
      - NEO4J_USERNAME=${NEO4J_USERNAME}
      - NEO4J_PASSWORD=${NEO4J_PASSWORD}
      - NEO4J_DATABASE=neo4j
      - NEO4J_TRANSPORT=http
      - NEO4J_MCP_SERVER_HOST=0.0.0.0
      - NEO4J_MCP_SERVER_PORT=8081
      - NEO4J_MCP_SERVER_PATH=/api/mcp/
    networks: [internal]  # Только внутренний доступ
    depends_on: [neo4j]

  neo4j:
    image: neo4j:5.15
    restart: unless-stopped
    environment:
      - NEO4J_AUTH=${NEO4J_USERNAME}/${NEO4J_PASSWORD}
    networks: [internal]  # Только внутренний доступ
    volumes:
      - neo4j_data:/data

networks:
  public:
    driver: bridge
  internal:
    driver: bridge
    internal: true  # Изолированная сеть

volumes:
  neo4j_data:
```

Команды:
```bash
docker compose pull && docker compose up -d
docker compose logs -f waymates-mcp | cat
```

#### 18.5 Секреты/схемы
- Секреты (Neo4j креды) храните в `.env` на IaaS или Secret Manager провайдера.
- Схемы по умолчанию в образе; для override — смонтируйте приватный том в `SCHEMA_DIR` (read‑only).

#### 18.6 Обновления/откат
```bash
# Обновление до latest
docker compose pull && docker compose up -d

# Откат по digest/sha‑тегу
docker compose down
docker run ghcr.io/<org>/<repo>:<sha> # проверить
# затем заменить тег в compose и поднять
```

