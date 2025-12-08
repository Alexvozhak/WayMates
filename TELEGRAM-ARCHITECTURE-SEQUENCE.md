# Telegram Bot Architecture — Sequence Diagram

## Три компонента системы

```mermaid
sequenceDiagram
    participant User as 📱 Telegram Client<br/>(WhatsApp/iOS/Android)
    participant TG as 🌐 Telegram Server<br/>(api.telegram.org)
    participant Bot as 🤖 Наш Telegram Bot<br/>(Grammy + Axios)
    participant Facade as 🔧 Facade MCP<br/>(Express)

    Note over User,Facade: Обычное сообщение от пользователя

    User->>TG: Отправляет "/by_target ML Engineer"
    TG->>Bot: Webhook POST /webhook<br/>или Polling getUpdates

    Bot->>Bot: Grammy обрабатывает update
    Bot->>Bot: Парсит команду через NLP

    Bot->>Facade: HTTP POST /mcp<br/>Axios: callTool("search_by_target", {...})
    Facade->>Facade: Выполняет Cypher query
    Facade-->>Bot: JSON { candidates: [...] }

    Bot->>Bot: Форматирует результат через LLM
    Bot->>TG: sendMessage(chat_id, text)
    TG->>User: Показывает результат
```

## Детальный поток с Webhook Secret

```mermaid
sequenceDiagram
    participant Hacker as 🕵️ Злоумышленник
    participant TG as 🌐 Telegram Server
    participant Bot as 🤖 Telegram Bot
    participant Facade as 🔧 Facade MCP

    Note over Hacker,Bot: ❌ Попытка атаки

    Hacker->>Bot: POST /webhook<br/>Поддельный update (БЕЗ secret)
    Bot->>Bot: Grammy проверяет<br/>X-Telegram-Bot-Api-Secret-Token
    Bot-->>Hacker: 401 Unauthorized

    Note over TG,Facade: ✅ Легитимный запрос

    TG->>Bot: POST /webhook<br/>Header: X-Telegram-Bot-Api-Secret-Token: "ABC123"
    Bot->>Bot: Grammy проверяет secret → ОК
    Bot->>Facade: Axios POST /mcp<br/>callTool(...)
    Facade-->>Bot: Response
    Bot->>TG: sendMessage
```

## Технологии

| Компонент | Назначение | Технология |
|-----------|-----------|------------|
| **Telegram Client** | Приложение пользователя | iOS/Android/Desktop |
| **Telegram Server** | Центральный сервер Telegram | api.telegram.org |
| **Наш Telegram Bot** | Обработка команд, бизнес-логика | Grammy (фреймворк) |
| **Axios в боте** | HTTP клиент для запросов к Facade | axios (библиотека) |
| **Facade MCP** | MCP сервер, работа с Neo4j | Express + FastMCP |

## Почему НЕ нужен Express в Telegram Bot?

**Polling режим (текущий):**
```typescript
// Grammy сам запрашивает updates у Telegram
await bot.start(); // Внутри: setInterval(() => axios.get("getUpdates"))
```

**Webhook режим (будущий):**
```typescript
// Grammy использует встроенный http.createServer
const handleWebhook = webhookCallback(bot, "std/http", {
  secretToken: env.TELEGRAM_WEBHOOK_SECRET,
});

// Встроенный HTTP сервер (НЕ Express!)
http.createServer(handleWebhook).listen(3000);
```

**Вывод:** Grammy имеет встроенный HTTP сервер для webhook. Express НЕ нужен.
