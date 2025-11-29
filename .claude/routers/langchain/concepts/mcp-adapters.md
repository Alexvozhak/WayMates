# MCP Adapters — @langchain/mcp-adapters

**Назначение**: Подключение LangChain agents к MCP серверам.

**Источник**: https://docs.langchain.com/oss/javascript/langchain/mcp

---

## Что это

Официальный LangChain адаптер для Model Context Protocol (MCP). Позволяет LangChain agents использовать tools определённые на MCP серверах.

**npm**: `@langchain/mcp-adapters`

---

## Установка

```bash
npm install @langchain/mcp-adapters
```

---

## Ключевые компоненты

| Компонент | Назначение |
|-----------|------------|
| `MultiServerMCPClient` | Клиент для подключения к нескольким MCP серверам |
| `loadMCPTools` | Загрузка tools из MCP client session |
| `getTools()` | Получение LangChain-совместимых tools |

---

## Transport Types

MCP поддерживает три механизма коммуникации:

| Transport | Описание | Когда использовать |
|-----------|----------|-------------------|
| `stdio` | Client запускает server как subprocess | Локальные tools, простой setup |
| `streamable_http` | Server работает независимо через HTTP | Remote connections, multiple clients |
| `sse` | Server-Sent Events для real-time streaming | Legacy MCP servers |

---

## Базовый пример

```typescript
import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import { createAgent } from "langchain";

// 1. Создаём клиент с конфигурацией серверов
const client = new MultiServerMCPClient({
  math: {
    transport: "stdio",
    command: "node",
    args: ["/path/to/math_server.js"],
  },
  weather: {
    transport: "sse",
    url: "http://localhost:8000/mcp",
  },
});

// 2. Получаем LangChain tools
const tools = await client.getTools();

// 3. Создаём агент (LangChain v1 API)
const agent = createAgent({
  model: "claude-sonnet-4-5-20250929",
  tools,
});

// 4. Вызываем
const response = await agent.invoke({
  messages: [{ role: "user", content: "what's (3 + 5) x 12?" }],
});

// 5. Cleanup
await client.close();
```

---

## Подключение к нескольким серверам

```typescript
import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import { createAgent } from "langchain";

const client = new MultiServerMCPClient({
  // stdio transport (локальный сервер)
  math: {
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-math"],
  },
  // HTTP transport (удалённый сервер)
  weather: {
    transport: "streamable_http",
    url: "http://localhost:8000/mcp",
    headers: {
      Authorization: "Bearer YOUR_TOKEN",
    },
  },
});

const tools = await client.getTools();
const agent = createAgent({ model: "gpt-4o", tools });

// Вызов math tool
const mathResponse = await agent.invoke({
  messages: [{ role: "user", content: "what's (3 + 5) x 12?" }],
});

// Вызов weather tool
const weatherResponse = await agent.invoke({
  messages: [{ role: "user", content: "what is the weather in nyc?" }],
});

await client.close();
```

---

## Stateful Sessions

Для серверов которые хранят контекст между вызовами:

```typescript
import { loadMCPTools } from "@langchain/mcp-adapters/tools.js";

const client = new MultiServerMCPClient({...});

// Создаём persistent session
const session = await client.session("math");

// Загружаем tools из session
const tools = await loadMCPTools(session);
```

---

## Конфигурация

### Опции MultiServerMCPClient

```typescript
const client = new MultiServerMCPClient({
  throwOnLoadError: true,           // Бросать ошибку при загрузке tools
  prefixToolNameWithServerName: false,  // Добавить имя сервера к tool names
  additionalToolNamePrefix: "",     // Кастомный prefix для tool names
  useStandardContentBlocks: true,   // Формат вывода как standard content blocks
  mcpServers: {
    serverName: {
      transport: "stdio",           // или "sse", "streamable_http"
      command: "node",              // Команда для запуска (stdio)
      args: ["server.js"],          // Аргументы (stdio)
      url: "http://...",            // URL сервера (sse/http)
      headers: {},                  // HTTP headers (sse/http)
      env: {},                      // Environment variables (stdio)
      restart: {                    // Reconnection strategy
        enabled: true,
        maxAttempts: 3,
        delayMs: 1000,
      },
    },
  },
});
```

---

## Пример: WayMates MCP Server

```typescript
import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import { createAgent } from "langchain";

const client = new MultiServerMCPClient({
  waymates: {
    transport: "stdio",
    command: "npx",
    args: ["tsx", "src/facade/mcp-server/index.ts"],
    env: {
      NEO4J_URI: "bolt://localhost:7689",
      NEO4J_USER: "neo4j",
      NEO4J_PASSWORD: "testpassword123",
      GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
    },
  },
});

const tools = await client.getTools();

const agent = createAgent({
  model: "models/gemini-2.0-flash",
  tools,
});

const response = await agent.invoke({
  messages: [{ role: "user", content: "Хочу рассказать свою карьерную историю" }],
});

await client.close();
```

---

## Создание MCP Server

Используй `@modelcontextprotocol/sdk`:

```bash
npm install @modelcontextprotocol/sdk
```

### Пример Math Server (stdio)

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  { name: "math-server", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

// Список tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "add",
      description: "Add two numbers",
      inputSchema: {
        type: "object",
        properties: {
          a: { type: "number", description: "First number" },
          b: { type: "number", description: "Second number" },
        },
        required: ["a", "b"],
      },
    },
  ],
}));

// Обработка tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "add") {
    const { a, b } = request.params.arguments as { a: number; b: number };
    return {
      content: [{ type: "text", text: String(a + b) }],
    };
  }
  throw new Error(`Unknown tool: ${request.params.name}`);
});

// Запуск
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main();
```

---

## Интеграция с LangWatch Scenario

```typescript
import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import { createAgent } from "langchain";
import scenario, { type AgentAdapter, AgentRole } from "@langwatch/scenario";

// Создаём MCP client и agent
const client = new MultiServerMCPClient({...});
const tools = await client.getTools();
const agent = createAgent({ model: "models/gemini-2.0-flash", tools });

// AgentAdapter для LangWatch
const e2eAdapter: AgentAdapter = {
  role: AgentRole.AGENT,
  async call(input) {
    const response = await agent.invoke({
      messages: input.messages,
    });
    return response.messages.at(-1)?.content;
  },
};

// Запуск симуляции
const result = await scenario.run({
  name: "E2E Test",
  description: "...",
  agents: [e2eAdapter, scenario.userSimulatorAgent(), scenario.judgeAgent({...})],
  maxTurns: 20,
});

await client.close();
```

---

## Ссылки

- **Официальная документация**: https://docs.langchain.com/oss/javascript/langchain/mcp
- **GitHub**: https://github.com/langchain-ai/langchainjs/tree/main/libs/langchain-mcp-adapters
- **npm**: https://www.npmjs.com/package/@langchain/mcp-adapters
- **MCP Protocol**: https://modelcontextprotocol.io/introduction
- **ADR-006**: [E2E Testing Architecture](../../../../docs/facade/decisions/ADR-006.md)
