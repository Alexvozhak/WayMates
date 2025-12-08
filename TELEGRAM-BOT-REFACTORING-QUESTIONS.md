# Telegram Bot Refactoring — Ответы и Вопросы

> **Дата**: 2025-12-08
> **Формат**: Ответы на вопросы пользователя + новые вопросы для уточнения

---

## 📋 Оглавление

1. [Ответы на Ваши Вопросы](#ответы-на-ваши-вопросы)
2. [Новые Вопросы для Уточнения](#новые-вопросы-для-уточнения)
3. [Фиксированные Решения](#фиксированные-решения)

---

## Ответы на Ваши Вопросы

### 1. Axios vs Express в Telegram Bot

**Ваш вопрос**: "кажется мы ошибочно использовали axios в телеграме, у нас фасад на express написан уже. целесообразней было бы и в телеграме экспресс использовать вместо axios?"

**Ответ**: ❌ **НЕТ, это разные инструменты для разных задач!**

**Разница**:

| Инструмент | Роль | Задача | Направление |
|-----------|------|--------|-------------|
| **Express** | HTTP **сервер** | **Принимает** запросы | Входящий трафик ← |
| **Axios** | HTTP **клиент** | **Отправляет** запросы | Исходящий трафик → |

**Express** (принимает запросы):
```typescript
const app = express();

app.post("/webhook", (req, res) => {
  // ← Telegram отправляет webhook сюда
  res.status(200).send("OK");
});

app.listen(3000);  // Ждём входящих запросов
```

**Axios** (отправляет запросы):
```typescript
// Telegram Bot → Facade MCP
const response = await axios.post("https://facade-mcp-url/mcp", {
  jsonrpc: "2.0",
  method: "tools/call",
  params: { name: "cold_start", arguments: {...} }
});
```

**В Telegram боте нам нужны ОБА**:
- **Express** (или `http.createServer`) — для приёма webhooks от Telegram (webhook mode)
- **Axios** — для отправки запросов к Facade MCP

**Вывод**: ✅ **Axios правильный выбор для MCP клиента!**

---

### 2. pendingAction — Best Practice?

**Ваш вопрос**: "pendingAction?: PendingAction; // Ожидающее действие (story/by_target/etc) - pendingAction вообще норм подход? не велосипед? best practice?"

**Ответ**: ✅ **ДА, это стандартный паттерн для conversation state в chat ботах!**

**Почему это best practice?**

1. **Multi-step conversations** — частый сценарий в Telegram ботах:
   ```
   User: /by_target
   Bot: "Опишите целевую позицию:"
     ↓ (бот ожидает следующее сообщение)
   User: "Senior ML Engineer в финтехе"
   Bot: [выполняет поиск]
   ```

2. **Grammy session plugin поддерживает** этот паттерн из коробки

3. **Production примеры**:
   - Grammy documentation — официальные examples
   - Aiogram (Python) — FSM (Finite State Machine)
   - python-telegram-bot — ConversationHandler
   - Telegraf (Node.js) — Scenes

**Альтернатива** — Finite State Machine (FSM):
```typescript
// FSM подход (overkill для простых случаев)
type BotState = "idle" | "awaiting_target" | "awaiting_adhoc" | "awaiting_story";

ctx.session.state = "awaiting_target";  // Более verbose
```

**Вывод**: ✅ **Оставляем `pendingAction` (best practice для простых multi-step conversations)**

---

### 3. Request Timeout — Таймаут в ENV? ✅

**Ваш вопрос**: "Request Timeout - Глубокий анализ. Вариант 4: Axios с timeout его! только таймаут переменную в енв?"

**Ответ**: ✅ **Согласен! Axios + timeout из .env**

**Реализация**:
```typescript
// .env
FACADE_REQUEST_TIMEOUT_MS=30000  // 30 секунд

// src/telegram-bot/env.ts
export const env = {
  // ...
  facadeRequestTimeoutMs: z.coerce.number().min(1000).max(60000).default(30000),
};

// src/telegram-bot/services/mcp-client.ts
export class McpClient {
  private axiosInstance: AxiosInstance;

  constructor(private baseUrl: string, timeoutMs: number) {
    this.axiosInstance = axios.create({
      baseURL: baseUrl,
      timeout: timeoutMs,  // ✅ Из .env
      headers: { "Content-Type": "application/json" },
    });
  }
}

// index.ts
const mcpClient = new McpClient(
  env.FACADE_MCP_URL,
  env.FACADE_REQUEST_TIMEOUT_MS  // ✅ Передаём из .env
);
```

**Зафиксировано в плане** ✅

---

### 4. Conversation State Cleanup — Зачем Локальный Redis?

**Ваш вопрос**: "я так и не понял зачем нам локальный редис, почему мы получаемые от фасадного редиса данные храним в телеграмном редисе и с другим ттл. я пока точно против разделять ттл по полям. мы вроде в предыдущих сессиях и доках уже разбирали этот вопрос, пришли к какому-то соглашению."

**Ответ**: ✅ **Локальный Redis нужен для Grammy session plugin (Bot UI state)**

**Telegram Redis и Facade Redis хранят РАЗНЫЕ данные**:

| Store | Что хранит | TTL | Owner | Почему? |
|-------|-----------|-----|-------|---------|
| **Telegram Redis** | Bot UI state: `pendingAction`, `sessionId` (cache), `hasStory` (cache), `token` | Длинный (7 дней) | Telegram Bot | UX - пользователь не теряет state |
| **Facade Redis** | User session для MCP tools, активные LangGraph states | Короткий (30 мин?) | Facade | Security - короткий TTL для session |

**Это НЕ дублирование!** Это **cache pattern**:

```
Telegram Redis (cache):
  sessionId: "sess_abc123"  ← кэш для быстрого доступа
  hasStory: true            ← кэш (избегаем лишних запросов к Facade)
  token: "uuid-v7"          ← для /token команды
  pendingAction: "by_target" ← Bot UI state (Facade не знает!)

Facade Redis (source of truth):
  session:sess_abc123:
    userId: "user_xyz"
    langGraphState: {...}   ← cold_start, search states
    ttl: 30 минут           ← безопасность (короткий TTL)
```

**Workflow**:

**Сценарий 1: Telegram Redis протухает (7 дней неактивности)**
```
Bot: ctx.session.sessionId = "" (Redis TTL истёк)
  ↓
Bot: await sessionService.initialize(ctx)
  → register_telegram → Facade создаёт НОВЫЙ sessionId
  ↓
Bot сохраняет в Redis: sessionId, hasStory, token (TTL 7 дней)
```

**Сценарий 2: Facade session протухает (30 мин неактивности)**
```
Bot: отправляет old sessionId к Facade
  ↓
Facade: "session_expired" (Redis TTL истёк)
  ↓
Bot: await sessionService.refresh(ctx)
  → register_telegram → Facade создаёт НОВЫЙ sessionId
  ↓
Bot обновляет Redis: новый sessionId (TTL 7 дней)
```

**Зачем разные TTL?**
- **Telegram Redis (7 дней)** — UX: пользователь редко пишет, но не хочет регистрироваться заново
- **Facade Redis (30 мин)** — Security: LangGraph states протухают быстро (не храним активные states долго)

**Вывод**:
- ✅ Локальный Redis НУЖЕН (Grammy session plugin требует storage)
- ✅ Разные TTL НУЖНЫ (UX vs Security)
- ❌ TTL на каждое поле НЕ нужен (вы против — используем Global TTL)

**Зафиксировано в плане**: Global TTL 7 дней для Telegram Redis ✅

---

### 5. Health Check — Что Проверять?

**Ваш вопрос**: "/health/liveness → Процесс жив? (для k8s liveness probe) /health/readiness → Готов принимать трафик? (для k8s readiness probe)" непонятные мне термины. вообще это раздел про то, что на старте проверять не только редис, но и все остальные компоненты или про то, что вывести health ручки для ci? кстати, у фасада есть ручка health."

**Ответ**: 📝 **Это про два разных кейса — см. ниже вопросы для уточнения**

**Термины Kubernetes**:

**Liveness probe** (процесс жив?):
```
Kubernetes каждые 10 секунд:
  GET /health/liveness → 200 OK?

Если НЕТ → Kubernetes убивает контейнер и перезапускает
```

**Readiness probe** (готов принимать трафик?):
```
Kubernetes каждые 10 секунд:
  GET /health/readiness → 200 OK?

Если НЕТ → Kubernetes НЕ шлёт трафик на этот pod (убирает из load balancer)
```

**Два кейса**:

#### Кейс 1: Проверка на старте (простой)

```typescript
// index.ts

async function startBot() {
  logger.info("Starting bot...");

  // 1. Проверить Redis
  try {
    await redis.ping();
    logger.info("Redis connection OK");
  } catch (error) {
    logger.error("Redis connection FAILED");
    process.exit(1);  // ❌ Fail fast
  }

  // 2. Проверить Facade
  try {
    await fetch(`${env.FACADE_MCP_URL}/health`);
    logger.info("Facade health OK");
  } catch (error) {
    logger.error("Facade health FAILED");
    process.exit(1);  // ❌ Fail fast
  }

  // 3. Стартовать бота
  await bot.start();
  logger.info("Bot started successfully");
}
```

**Когда использовать**: Development, простые деплои (без Kubernetes)

---

#### Кейс 2: Health ручки для Kubernetes (сложнее)

```typescript
// index.ts (если используем webhooks)

const server = http.createServer(async (req, res) => {
  if (req.url === "/health/liveness") {
    // Процесс жив? (быстрая проверка)
    res.writeHead(200);
    res.end("OK");
    return;
  }

  if (req.url === "/health/readiness") {
    // Redis + Facade доступны?
    try {
      await redis.ping();
      await fetch(`${env.FACADE_MCP_URL}/health`);
      res.writeHead(200);
      res.end("OK");
    } catch (error) {
      logger.error({ err: error }, "Readiness check failed");
      res.writeHead(503);  // Service Unavailable
      res.end("Not ready");
    }
    return;
  }

  if (req.url === "/webhook") {
    await handleWebhook(req, res);
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(env.PORT);
```

**Когда использовать**: Production в Kubernetes

**Kubernetes deployment.yaml**:
```yaml
apiVersion: v1
kind: Pod
spec:
  containers:
  - name: telegram-bot
    livenessProbe:
      httpGet:
        path: /health/liveness
        port: 3000
      initialDelaySeconds: 10
      periodSeconds: 10
    readinessProbe:
      httpGet:
        path: /health/readiness
        port: 3000
      initialDelaySeconds: 5
      periodSeconds: 10
```

---

**Вопросы для уточнения** (см. раздел ниже):
1. Нужен ли вообще Health Check сейчас?
2. Если нужен — Кейс 1 (старт) или Кейс 2 (K8s)?
3. Интегрироваться с Facade `/health`?

---

### 6. Graceful Shutdown — Redis OK, Health НЕТ ✅

**Ваш вопрос**: "Проблема: Не закрывает Redis connection! - но при этом даешь примеры уже с health интегрированным. я согласен redis закрыть, но не согласен пока на health."

**Ответ**: ✅ **Согласен! Закрываем Redis, БЕЗ health интеграции**

**Реализация**:
```typescript
// index.ts

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "Shutdown signal received");

  // 1. Остановить бота (прекратить принимать сообщения)
  await bot.stop();

  // 2. Закрыть Redis соединение
  await redis.quit();  // ✅ Вы согласны

  // ❌ Health интеграция НЕ добавляем (вы против пока)
  // await healthChecker.stop();

  logger.info("Graceful shutdown complete");
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
```

**Зафиксировано в плане** ✅

---

### 7. Webhook Secret Validation — Как Защищает?

**Ваш вопрос**: "✅ Решение С secret token - ок. только непонятно как этот токен нас защищает от злоумышленников. Не понимаю что с чем сверяется, кем, где, и когда. Злоумышленник представляется пользователем телеграмма и пишет нам в телеграм бота? а мы должны каждому пользователю сопоставлять его userid с выданным ему токеном? и пользователь должен в каждом своем запросе предъявлять этот токен?"

**Ответ**: 📖 **Webhook secret — это НЕ user token! Это защита от поддельных webhook запросов**

**Как это работает?**

#### Шаг 1: Настройка webhook (один раз при деплое)

```bash
# Вы генерируете secret token (один для всего бота)
SECRET_TOKEN="randomly_generated_secret_token_123"

# Отправляете его в Telegram API
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-server.com/webhook",
    "secret_token": "'$SECRET_TOKEN'"  # ← Telegram запоминает токен
  }'
```

После этого Telegram знает:
- Ваш webhook URL: `https://your-server.com/webhook`
- Ваш secret token: `randomly_generated_secret_token_123`

---

#### Шаг 2: Telegram отправляет КАЖДЫЙ webhook с заголовком

Когда **ЛЮБОЙ пользователь** пишет вашему боту:

```
Пользователь (user_id=456): "/start"
  ↓
Telegram сервер формирует webhook запрос:

POST /webhook HTTP/1.1
Host: your-server.com
X-Telegram-Bot-Api-Secret-Token: randomly_generated_secret_token_123  # ← SECRET!
Content-Type: application/json

{
  "update_id": 123,
  "message": {
    "from": {"id": 456, "username": "user"},
    "text": "/start"
  }
}
```

**ВАЖНО**: Secret token — это **ВАШ** токен (один для бота), НЕ токен пользователя!

---

#### Шаг 3: Grammy проверяет заголовок

```typescript
// bot.ts

const handleWebhook = webhookCallback(bot, "std/http", {
  secretToken: env.TELEGRAM_WEBHOOK_SECRET,  // ← "randomly_generated_secret_token_123"
});

// Grammy внутри проверяет:
const receivedToken = req.headers["x-telegram-bot-api-secret-token"];

if (receivedToken !== secretToken) {
  // ❌ Токен НЕ совпадает → reject request
  res.writeHead(401);
  res.end("Unauthorized");
  return;
}

// ✅ Токен совпадает → обрабатываем запрос
await bot.handleUpdate(update);
```

---

#### Атака БЕЗ secret token (уязвимость)

```
Злоумышленник знает ваш webhook URL: https://your-server.com/webhook
  ↓
Отправляет поддельный webhook:

POST /webhook HTTP/1.1
Host: your-server.com
Content-Type: application/json

{
  "message": {
    "from": {"id": 456, "username": "victim"},  # ← Представляется жертвой
    "text": "/link STOLEN_TOKEN"
  }
}
  ↓
Ваш сервер обрабатывает как легитимный запрос!
  ↓
Злоумышленник может:
- Отправлять команды от имени жертвы
- Красть токены через /link
- Читать ответы бота
```

---

#### Защита С secret token

```
Злоумышленник НЕ ЗНАЕТ secret_token (известен только Telegram и вашему серверу)
  ↓
Отправляет поддельный webhook:

POST /webhook HTTP/1.1
Host: your-server.com
Content-Type: application/json

{
  "message": {
    "from": {"id": 456, "username": "victim"},
    "text": "/link STOLEN_TOKEN"
  }
}
  ↓
Grammy проверяет заголовок:
  ❌ X-Telegram-Bot-Api-Secret-Token отсутствует
  ↓
Grammy возвращает 401 Unauthorized
  ↓
Запрос отклонён!
```

**Только Telegram знает secret_token** → только его запросы проходят.

---

**Итог**:
- **Webhook secret** — НЕ про user_id
- **Webhook secret** — защита от поддельных webhook запросов к вашему серверу
- **User_id** — часть payload, бот различает пользователей через `ctx.from.id`

**Зафиксировано в плане** ✅

---

### 8. Фиксированные Решения из Доков

**Ваш вопрос**: "кстати, принятые решения из предыдущего дока и в этом доке - фиксируй в новом доке рефакторинга"

**Ответ**: ✅ **Все фиксированные решения перенесены в TELEGRAM-BOT-REFACTORING-PLAN.md**

См. раздел [Фиксированные Решения](#фиксированные-решения) ниже.

---

## Новые Вопросы для Уточнения

### Вопрос 1: Health Check — Нужен Ли Вообще?

**Контекст**: Вы не уверены нужен ли Health Check сейчас.

**Варианты**:

#### Вариант A: Не нужен сейчас (минимализм)
- Проверки при старте НЕТ
- Health ручки НЕТ
- Полагаемся на Grammy error handling + bot.catch()

**Плюсы**:
- ✅ Меньше кода
- ✅ Быстрее к production

**Минусы**:
- ⚠️ Бот может стартануть с недоступным Redis/Facade
- ⚠️ Kubernetes не сможет проверить readiness

---

#### Вариант B: Только проверка на старте (Кейс 1)
```typescript
// index.ts

async function startBot() {
  // Проверяем Redis + Facade ОДИН РАЗ при старте
  await redis.ping();
  await fetch(`${env.FACADE_MCP_URL}/health`);

  // Если OK → стартуем
  await bot.start();
}
```

**Плюсы**:
- ✅ Fail-fast (бот не стартует если что-то сломано)
- ✅ Простая реализация (~10 строк кода)

**Минусы**:
- ⚠️ Нет runtime мониторинга (если Redis упадёт после старта — не узнаем)

---

#### Вариант C: Health ручки для Kubernetes (Кейс 2)
```typescript
// index.ts

const server = http.createServer(async (req, res) => {
  if (req.url === "/health/liveness") {
    res.writeHead(200);
    res.end("OK");
    return;
  }

  if (req.url === "/health/readiness") {
    try {
      await redis.ping();
      await fetch(`${env.FACADE_MCP_URL}/health`);
      res.writeHead(200);
      res.end("OK");
    } catch {
      res.writeHead(503);
      res.end("Not ready");
    }
    return;
  }

  if (req.url === "/webhook") {
    await handleWebhook(req, res);
  }
});
```

**Плюсы**:
- ✅ Kubernetes может проверять readiness
- ✅ Runtime мониторинг (каждые 10 секунд)

**Минусы**:
- ⚠️ Больше кода (~40 строк)
- ⚠️ Только для webhook mode (polling mode не нужен)

---

**Ваш выбор?**
- [ ] **Вариант A** — Не нужен сейчас
- [ ] **Вариант B** — Только проверка на старте
- [ ] **Вариант C** — Health ручки для Kubernetes

---

### Вопрос 2: Facade Health Endpoint — Интегрироваться?

**Контекст**: У фасада есть `/health` endpoint.

**Варианты**:

#### Вариант A: Проверять Facade health
```typescript
// Проверяем что Facade жив
await fetch(`${env.FACADE_MCP_URL}/health`);
```

**Плюсы**:
- ✅ Знаем что Facade доступен
- ✅ Можем не стартовать бота если Facade упал

**Минусы**:
- ⚠️ Дополнительная зависимость (если Facade health сломается)

---

#### Вариант B: НЕ проверять Facade (минимализм)
```typescript
// Полагаемся на MCP client error handling
```

**Плюсы**:
- ✅ Меньше зависимостей
- ✅ MCP client уже обрабатывает ошибки

**Минусы**:
- ⚠️ Бот может стартануть с недоступным Facade

---

**Ваш выбор?**
- [ ] **Вариант A** — Проверять Facade `/health`
- [ ] **Вариант B** — НЕ проверять (минимализм)

---

### Вопрос 3: i18n Локализация — Сейчас Или Позже?

**Контекст**: В плане есть i18n локализация (Fluent), но пока не согласовано.

**Варианты**:

#### Вариант A: i18n сейчас (Fluent)
```typescript
// locales/ru.ftl
action-required = ⚠️ Сначала выберите действие:

    /story — Рассказать карьерную историю
    /by_target — Поиск по целевой позиции

// handlers/text.ts
await ctx.reply(ctx.t("action-required"));
```

**Плюсы**:
- ✅ Мультиязычность (ru + en)
- ✅ Централизованные тексты

**Минусы**:
- ⚠️ Больше кода (~200 строк локализаций)
- ⚠️ Дополнительная зависимость (@fluent/bundle)

---

#### Вариант B: Хардкод текстов (минимализм)
```typescript
// handlers/text.ts
await ctx.reply(
  "⚠️ Сначала выберите действие:\n\n" +
  "/story — Рассказать карьерную историю\n" +
  "/by_target — Поиск по целевой позиции"
);
```

**Плюсы**:
- ✅ Проще (нет зависимостей)
- ✅ Быстрее к production

**Минусы**:
- ⚠️ Только русский язык
- ⚠️ Тексты разбросаны по коду

---

**Ваш выбор?**
- [ ] **Вариант A** — i18n сейчас (Fluent)
- [ ] **Вариант B** — Хардкод текстов (позже добавим i18n)

---

## Фиксированные Решения

**Из предыдущих доков и текущих ответов**:

### Production Readiness (P0)

1. ✅ **Request Timeout**: Axios с timeout из .env (`FACADE_REQUEST_TIMEOUT_MS`)
2. ✅ **Conversation State Cleanup**: Global TTL 7 дней для Telegram Redis
3. ✅ **Graceful Shutdown**: Закрыть Redis соединение (БЕЗ health интеграции)

### Архитектурные Решения

4. ✅ **Axios vs Express**: Axios - правильный выбор для MCP client
5. ✅ **pendingAction**: Best practice для conversation state (оставляем)
6. ✅ **Response Schemas**: Переместить в `shared/schemas.ts`
7. ✅ **Tool Registry**: Вариант C (полная type safety)
8. ✅ **Discriminated Union**: `MySessionData` с `status` discriminator
9. ✅ **ООП Архитектура**: McpClient, SessionService, SearchPresenter (классы)
10. ✅ **Error Handling**: `parseJsonContent` → throwing, `tryParseJsonContent` → nullable
11. ✅ **cold_start.hasStory**: Facade проверяет БД и возвращает
12. ✅ **Username/FirstName**: НЕ отправляем в Facade (анонимная платформа)

### Code Quality (P0-P2)

13. ✅ **NLP Parser**: Generic function + валидация (выполнено в предыдущей сессии)
14. ✅ **Schema Cleanup**: Удалить `adhocSearchParamsBaseSchema` (выполнено)
15. ✅ **Search Utils**: `formatAndReplySearch` уже существует
16. ✅ **ACTION_REQUIRED_MESSAGE**: Использовать i18n (если выберем Вариант A для Вопроса 3)
17. ✅ **Proxy Functions**: Оставить (нужны для input routing)

### Security (P1)

18. ✅ **Webhook Secret Validation**: Решение C (secret token validation)

---

## Требуют Уточнения

**Ожидаем ваших ответов на вопросы**:
1. ℹ️ Health Check — Нужен ли? Какой вариант (A/B/C)?
2. ℹ️ Facade Health Endpoint — Проверять (A) или НЕТ (B)?
3. ℹ️ i18n Локализация — Сейчас (A) или позже (B)?

---

## Следующие Шаги

После ваших ответов на вопросы:
1. Обновлю `TELEGRAM-BOT-REFACTORING-PLAN.md` с финальными решениями
2. Начнём реализацию по фазам
3. Quality gates после каждой фазы (lint + tsc + tests)

**Готов к старту после ваших ответов** 🚀
