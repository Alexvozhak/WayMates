# Руководство по интеграции SDK

## Анализ реализации McpClient: от reimplementation к thin wrapper

Этот документ описывает паттерны и принципы работы с SDK, выявленные при рефакторинге `src/telegram-bot/services/mcp-client.ts`.

---

## 🎯 Проблема: Что пошло не так?

### Исходная реализация (~150 строк)

```typescript
// ❌ Реимплементация всего функционала SDK
class McpClient {
  private axiosInstance: AxiosInstance;

  constructor(baseUrl: string, timeoutMs: number) {
    this.axiosInstance = axios.create({ baseURL: baseUrl, timeout: timeoutMs });
  }

  private async sendWithRetry(toolName: string, params: unknown) {
    // Exponential backoff, max retries
    for (let attempt = 0; attempt < maxRetries; attempt++) { ... }
  }

  private async sendRequest(toolName: string, params: unknown) {
    // Ручная сборка JSON-RPC payload
    const response = await this.axiosInstance.post("", {
      jsonrpc: "2.0",
      id: ++requestId,
      method: "tools/call",
      params: { name: toolName, arguments: params }
    });
  }

  private parseJsonContent(result: McpToolResult) {
    // Ручной парсинг MCP response
    const mcpResponseSchema = z.object({ ... });
  }
}
```

**Что реализовано вручную:**
- HTTP client (axios)
- Retry logic (exponential backoff)
- JSON-RPC protocol (requestId, payload building)
- Response schemas (mcpResponseSchema)
- Error detection (isClientError, handleRetryError)

### Рефакторенная реализация (~65 строк)

```typescript
// ✅ Thin wrapper с delegation
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { CallToolResultSchema, TextContentSchema } from "@modelcontextprotocol/sdk/types.js";
import packageJson from "../../../package.json" with { type: "json" };

class McpClient {
  static async create(baseUrl: string): Promise<McpClient> {
    const client = new Client({
      name: packageJson.name,
      version: packageJson.version,
    });
    const transport = new StreamableHTTPClientTransport(new URL(baseUrl));
    await client.connect(transport);
    return new McpClient(client);
  }

  private constructor(private readonly client: Client) {}

  async callTool<T extends FacadeToolName>(
    toolName: T,
    params: Record<string, unknown>,
  ): Promise<ToolResponse<T>> {
    const tool = TOOL_REGISTRY[toolName];
    const validatedParams = tool.paramsSchema.parse(params);
    const rawResult = await this.client.callTool(
      { name: toolName, arguments: validatedParams },
      CallToolResultSchema,
    );
    const result = CallToolResultSchema.parse(rawResult);
    const content = TextContentSchema.parse(result.content[0]);
    return tool.responseSchema.parse(JSON.parse(content.text));
  }
}
```

**Делегируется SDK:**
- ✅ HTTP transport (StreamableHTTPClientTransport)
- ✅ JSON-RPC protocol (Client.callTool)
- ✅ Retry logic (встроен в SDK)
- ✅ Response schemas (CallToolResultSchema, TextContentSchema)
- ✅ Error handling (SDK бросает exceptions)

---

## 📋 Пробелы в промптах (CLAUDE.md, refactor-telegram-bot.md)

### 1. НЕТ PROACTIVE checklist (только REACTIVE code review)

**Что было:**
- code-review-protocol.md срабатывает ПОСЛЕ написания кода ("смущает код?")
- Секция "Проверка велосипеда" в контексте review, НЕ перед implementation

**Что нужно:**
- Checklist **ПЕРЕД** implementation:
  - ✅ Check SDK capabilities FIRST
  - ✅ List what SDK already provides
  - ✅ Don't reimplement SDK features

### 2. НЕТ "Thin Wrapper vs Adapter" guidance

**Что было:**
- В CLAUDE.md упоминаются паттерны (Builder, Strategy, Singleton)
- НЕТ guidance про wrapper patterns для SDK integration

**Что нужно:**
- Когда использовать **Thin Wrapper** (official SDK → delegation)
- Когда использовать **Adapter** (unstable API → full isolation)

### 3. НЕТ type-safe routing patterns

**Что было:**
- Type-First Development описывает type schemas
- НЕТ паттерна "centralized registry + mapped types"

**Что нужно:**
- Pattern: `TOOL_REGISTRY[key] → { paramsSchema, responseSchema }`
- Mapped types: `type ToolResponse<T extends ToolName> = ...`
- Type-safe routing вместо string literals

### 4. НЕТ Static Factory Pattern для async initialization

**Что было:**
- НЕТ упоминания про async constructor problem

**Что нужно:**
- `static async create() + private constructor()` для async initialization
- Почему: `await` нельзя в constructor

### 5. НЕТ метрик для "thin wrapper"

**Что было:**
- ESLint правила (complexity, max-depth)
- НЕТ метрик качества wrapper

**Что нужно:**
- Code size: < 100 строк (для rich SDK)
- Delegation ratio: 90%+ делегирования
- Features NOT reimplemented: HTTP, retry, schemas

---

## ✅ Принципы интеграции SDK (новая секция для code-review-protocol.md)

### 0. BEFORE Implementation - SDK Integration Checklist

**КОГДА ПРИМЕНЯТЬ:** Реализуешь wrapper/client/integration для SDK/library.

#### 🚨 TRIGGERS (останови и проверь):

- "Implementing wrapper for [SDK_NAME]"
- "Custom HTTP client / retry logic / JSON-RPC"
- "Zod schema for SDK response"
- "Class constructor with async operations"
- "Tool name as string parameter"
- "Hardcoded name/version/config"

#### 1. Check SDK capabilities FIRST

**BEFORE writing code:**

```bash
# Читай SDK documentation
context7: resolve-library-id → get-library-docs (topic: "Client", "Transport")

# Проверяй SDK exports
grep -r "export" node_modules/@sdk-name/*/index.d.ts

# Ищи SDK examples
WebFetch: "https://github.com/sdk-org/sdk-name/tree/main/examples"
```

**Вопросы для проверки:**
- [ ] Does SDK have Client class?
- [ ] Does SDK have Transport/HTTP layer?
- [ ] Does SDK have retry/error handling?
- [ ] Does SDK export types/schemas?
- [ ] Does SDK have official examples?

#### 2. Выбери wrapper strategy

| Характеристики SDK | Паттерн | Пример |
|-------------------|---------|--------|
| Official, stable, type-safe | **Thin Wrapper** (delegation) | MCP SDK, AWS SDK |
| Unstable, changing, poor types | **Adapter** (isolation) | Beta APIs, legacy libs |

**Thin Wrapper checklist:**
- [ ] < 100 строк кода
- [ ] 90%+ delegation к SDK
- [ ] Import SDK schemas/types (не переопределяй)
- [ ] SDK transport > custom HTTP client
- [ ] SDK error handling > custom retry

#### 3. Type-safe patterns

**Centralized Registry (для routing):**

```typescript
// ❌ DON'T: String literals + повторяющиеся schemas
callTool(
  toolName: string,
  paramsSchema: z.ZodType,
  responseSchema: z.ZodType
)

// ✅ DO: Type-safe registry + mapped types
const TOOL_REGISTRY = {
  tool_a: {
    paramsSchema: z.object({...}),
    responseSchema: z.object({...})
  },
  tool_b: { ... },
} as const;

type FacadeToolName = keyof typeof TOOL_REGISTRY;
type ToolResponse<T extends FacadeToolName> =
  z.infer<typeof TOOL_REGISTRY[T]['responseSchema']>;

callTool<T extends FacadeToolName>(
  toolName: T
): Promise<ToolResponse<T>>
```

**Static Factory (для async init):**

```typescript
// ❌ DON'T: Async operations в constructor
constructor(url: string) {
  await this.connect(); // Can't await в constructor!
}

// ✅ DO: Static factory + private constructor
class McpClient {
  static async create(url: string): Promise<McpClient> {
    const client = new Client({ ... });
    const transport = new StreamableHTTPClientTransport(new URL(url));
    await client.connect(transport); // async initialization
    return new McpClient(client);
  }

  private constructor(private readonly client: Client) {}
}
```

#### 4. Single Source of Truth

**❌ DON'T hardcode:**

```typescript
const client = new Client({
  name: "my-bot",
  version: "1.0.0"
}); // Дублирует package.json
```

**✅ DO: Import from package.json:**

```typescript
import packageJson from "../package.json" with { type: "json" };

const client = new Client({
  name: packageJson.name,
  version: packageJson.version,
});
```

---

## 📊 Wrapper Quality Metrics

Перед финализацией, проверь:

```
[ ] Code size: < 100 строк (для rich SDK)
[ ] Delegation ratio: 90%+ делегировано SDK
[ ] Features NOT reimplemented:
    [ ] HTTP/transport layer
    [ ] Retry/backoff logic
    [ ] Protocol (JSON-RPC, REST, etc.)
    [ ] Schemas/types (imported from SDK)
[ ] Type safety:
    [ ] Typed unions (не string literals)
    [ ] Mapped types (не generic TParams/TResponse)
    [ ] Centralized registry (не repeated schemas)
[ ] Single Source of Truth:
    [ ] package.json metadata (name, version)
    [ ] Config не хардкоден
```

---

## 🔍 Сравнение подходов

### Adapter Pattern (полная изоляция)

**Когда использовать:**
- SDK нестабильный или часто меняется
- SDK имеет плохие типы
- Нужна полная изоляция от SDK (для будущей замены)

**Признаки:**
- ~150+ строк кода
- Реализует transport/retry/parsing
- Consumers НЕ знают о SDK существовании
- Высокая maintenance cost

### Thin Wrapper (delegation)

**Когда использовать:**
- SDK official, stable, type-safe
- SDK хорошо документирован
- Нужна только type-safe обертка

**Признаки:**
- < 100 строк кода
- 90%+ делегирования SDK
- Imports SDK types/schemas
- Низкая maintenance cost

---

## 💡 Ключевые выводы

### 1. Research SDK BEFORE implementation

**НЕ начинай coding без:**
- Чтения SDK documentation
- Изучения SDK examples
- Проверки SDK exports/types

### 2. Choose wrapper strategy consciously

**Задай вопрос:**
- SDK official/stable? → Thin Wrapper
- SDK unstable/poor? → Adapter

### 3. Use SDK features, don't reimplement

**Порядок приоритетов:**
1. SDK native feature (transport, retry, schemas)
2. Type-safe wrapper (registry + mapped types)
3. Custom implementation (только если SDK не имеет)

### 4. Measure wrapper quality

**Метрики:**
- Lines of code (< 100 для thin wrapper)
- Delegation ratio (90%+)
- Features NOT reimplemented
- Type safety level

---

## 📝 Итоговые рекомендации для CLAUDE.md

**Добавить в code-review-protocol.md секцию 0:**
- "BEFORE Implementation - SDK Integration Checklist"
- Triggers для остановки перед coding
- Checklist проверки SDK capabilities
- Wrapper strategy selection guide
- Type-safe patterns (registry, static factory, SoT)
- Wrapper quality metrics

**Почему в начало файла?**
- Применяется BEFORE coding (не reactive)
- Предотвращает reimplementation (не исправляет после)
- Триггеры работают при виде keywords ("wrapper", "client", "HTTP")

---

## 🎯 Конкретные инструкции себе (для промпта)

**TRIGGER KEYWORDS:**

```
IF task contains: "implement", "wrapper", "client", "SDK integration"
THEN:
  1. STOP coding
  2. Read SDK documentation (context7 or WebFetch)
  3. List SDK exports/types/schemas
  4. Check SDK examples
  5. Answer: "What does SDK already provide?"
  6. Choose strategy: Thin Wrapper vs Adapter
  7. START coding (with SDK delegation)
```

**FORBIDDEN ACTIONS:**

```
❌ Custom HTTP client (if SDK has transport)
❌ Custom retry logic (if SDK has retry)
❌ Custom protocol (if SDK handles JSON-RPC/REST)
❌ Custom schemas (if SDK exports types)
❌ Hardcoded config (if package.json has it)
❌ Async in constructor (use static factory)
❌ String literals (use typed unions + registry)
```

**QUALITY GATES:**

```
Before marking task complete:
[ ] Wrapper < 100 lines
[ ] Delegation ratio > 90%
[ ] No reimplemented SDK features
[ ] Type-safe routing (registry + mapped types)
[ ] Static factory (if async init)
[ ] Single Source of Truth (package.json)
```

---

_Документ создан на основе анализа git diff для `src/telegram-bot/services/mcp-client.ts` (commit: рефакторинг McpClient с axios на MCP SDK)._
