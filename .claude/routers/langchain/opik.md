# Opik Observability Router

**Версия**: 1.0
**Дата создания**: 2025-11-23
**Статус**: Активный
**Проверено на**: opik@1.0+, opik-gemini@1.0+, Gemini 2.0 Flash

---

## 🎯 Когда использовать этот роутер

**Используй ЭТОТ роутер когда**:

- Debugging CollectorAgent в cold-start workflow
- Нужно видеть промпты, responses, tool calls в UI
- Готовишь demo/presentation для инвесторов
- Оптимизируешь промпты (token usage, latency)
- Итерируешь по failed integration tests

**НЕ используй если**:

- Production environment (только development!)
- Нужен cloud-based мониторинг (используй LangSmith)
- Работаешь без Gemini (Opik лучше для Gemini)

---

## ⚡ Quick Start (5 минут)

### 1. Запустить self-hosted Opik

```bash
# Clone репозиторий
git clone https://github.com/comet-ml/opik.git
cd opik

# Запустить через Docker Compose
./opik.sh

# Дождаться сообщения:
# "Opik is running on http://localhost:5173"
```

### 2. Установить клиенты

```bash
cd /home/alex/projects/WayMatesRemote
npm install opik opik-gemini
```

### 3. Настроить .env

```bash
# Добавить в .env
OPIK_URL_OVERRIDE="http://localhost:5173/api"
```

### 4. Verify setup

```bash
# Health check
curl http://localhost:5173/api/health
# Should return: 200 OK

# Открыть UI
open http://localhost:5173
```

---

## 🚨 КРИТИЧЕСКИ ВАЖНО

### trackGemini - единственное изменение

```typescript
// ✅ ПРАВИЛЬНО - wrap базовую модель
import { trackGemini } from 'opik-gemini';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

const trackedModel = trackGemini(
  genAI.getGenerativeModel({ model: "models/gemini-2.0-flash" }),
  { traceMetadata: { tags: ["cold-start", "facade"] } }
);

// Используй trackedModel вместо базовой модели
const agent = createAgent({
  model: trackedModel,  // ← Единственное изменение
  tools: [...],
});

// ❌ НЕПРАВИЛЬНО - wrap ChatGoogleGenerativeAI (не поддерживается!)
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
const trackedModel = trackGemini(
  new ChatGoogleGenerativeAI({ model: "models/gemini-2.0-flash" })
);
```

### Tags обязательны

```typescript
// ✅ ПРАВИЛЬНО - добавляй tags для фильтрации
traceMetadata: { tags: ["cold-start", "facade", "normalization"] }

// ❌ НЕПРАВИЛЬНО - без tags
traceMetadata: {}  // Traces будут, но фильтровать сложно
```

### Environment variable

```bash
# ✅ ПРАВИЛЬНО - OPIK_URL_OVERRIDE для self-hosted
OPIK_URL_OVERRIDE="http://localhost:5173/api"

# ❌ НЕПРАВИЛЬНО - OPIK_API_KEY для cloud (мы используем self-hosted!)
OPIK_API_KEY="..."
```

---

## 🏗️ Integration в CollectorAgent

### Пример кода

```typescript
// src/facade/langchain/collector-agent.ts
import { createAgent, tool } from "langchain";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { trackGemini } from "opik-gemini";
import { z } from "zod";

// 1. Tools (без изменений)
const extractContextsTool = tool(
  async ({ contexts }) => {
    // Логика извлечения контекстов
    return { extracted: contexts };
  },
  {
    name: "extract_contexts",
    description: "Extract career contexts from user message",
    schema: z.object({
      contexts: z.array(z.object({
        position: z.string(),
        company: z.string(),
        skills: z.array(z.string()),
      })),
    }),
  }
);

const askClarificationTool = tool(
  async ({ questions }) => {
    // Логика уточняющих вопросов
    return { questions };
  },
  {
    name: "ask_clarification",
    description: "Ask batch of clarifying questions",
    schema: z.object({
      questions: z.array(z.string()),
    }),
  }
);

// 2. Wrap модель для Opik tracing
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

const trackedModel = trackGemini(
  genAI.getGenerativeModel({
    model: "models/gemini-2.0-flash",
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 2048,
    },
  }),
  {
    traceMetadata: {
      tags: ["cold-start", "facade", "normalization"],
      metadata: {
        environment: "development",
        version: "1.0",
      },
    },
  }
);

// 3. Создать агента (БЕЗ изменений кроме model)
export const collectorAgent = createAgent({
  model: trackedModel,  // ← Единственное изменение
  tools: [extractContextsTool, askClarificationTool],
  checkpointer: postgresCheckpointer,
  stateSchema: z.object({
    contexts: z.array(z.any()),
    questions: z.array(z.string()),
    status: z.enum(["collecting", "awaiting_clarification", "complete"]),
  }),
  systemPrompt: `You are a career history collector.

CRITICAL: Ask ALL clarifying questions in ONE batch, NOT one-by-one!`,
});

// 4. Export функция (БЕЗ изменений)
export async function collectContexts(
  message: string,
  threadId: string
): Promise<CollectResult> {
  const result = await collectorAgent.invoke({
    messages: [{ role: "user", content: message }],
  }, {
    configurable: { thread_id: threadId },
  });

  return parseResult(result);
}
```

---

## 💡 Best Practices

### 1. Используй tags для фильтрации

```typescript
// ✅ Хорошо - специфичные tags
tags: ["cold-start", "facade", "normalization"]

// ✅ Хорошо - добавляй context
tags: ["cold-start", "test-tc1-single-turn"]

// ❌ Плохо - слишком общие tags
tags: ["test"]
```

### 2. Добавляй metadata для контекста

```typescript
traceMetadata: {
  tags: ["cold-start"],
  metadata: {
    testCase: "TC1-single-turn",
    userId: "U1",
    expectedStatus: "complete",
  },
}
```

### 3. Проверяй UI после каждого failed test

```bash
# 1. Run integration test
npm run test:integration -- cold-start

# 2. Если failed → открой Opik UI
open http://localhost:5173

# 3. Фильтруй по tags
# Filter: tags contains "cold-start"

# 4. Inspect latest trace:
#    - User message → что отправили
#    - System prompt → правильные ли инструкции
#    - Tool calls → какие tools вызвал агент
#    - Response → что вернул LLM
#    - Tokens → performance метрики
```

### 4. Останавливай Opik после сессии

```bash
# Остановить Docker containers
cd opik
docker compose down

# Опционально - очистить данные
docker compose down -v
```

---

## ✅ DO / ❌ DON'T

### ✅ DO

- **Use tags** для фильтрации traces по feature/test case
- **Проверяй UI** после failed tests (видишь промпты + responses)
- **Смотри token usage** для оптимизации промптов
- **Используй для demo** (профессиональный UI для презентаций)
- **Добавляй metadata** для контекста (testCase, userId, etc.)
- **Останавливай Opik** после сессии (`docker compose down`)

### ❌ DON'T

- **НЕ используй в production** (только development + demo!)
- **НЕ коммить API keys** в .env (`.env` в `.gitignore`)
- **НЕ забывай `tags`** (без них фильтровать сложно)
- **НЕ wrap ChatGoogleGenerativeAI** (используй базовый `genAI.getGenerativeModel`)
- **НЕ используй cloud Opik** (self-hosted лучше для MVP)

---

## 🔍 Debugging Workflow

### Сценарий 1: Integration test failed

```bash
# 1. Run test
npm run test:integration -- cold-start

# Output:
# ❌ TC1: Single-turn complete context
#    Expected status: "complete"
#    Actual status: "awaiting_clarification"
```

**Debugging steps**:

1. **Открой Opik UI**: `http://localhost:5173`
2. **Фильтруй по tags**: `tags contains "cold-start"`
3. **Find latest trace** (сортируй по timestamp)
4. **Inspect**:
   - **User message**: "I worked as ML Engineer at Google for 3 years..."
   - **System prompt**: Проверь инструкции - есть ли "extract contexts if complete"?
   - **Tool calls**: Какой tool вызвал агент? `ask_clarification` вместо `extract_contexts`?
   - **Response**: Почему агент решил задать вопросы?
   - **Tokens**: 1500 input, 200 output → нормально
5. **Fix prompt**: Обнови `systemPrompt` в `collector-agent.ts`
6. **Re-run test**: Verify в UI что теперь вызывается `extract_contexts`

### Сценарий 2: Agent задает one-by-one вопросы

```bash
# Test shows:
# ❌ TC2: Multi-turn dialog
#    Expected: 1 batch of 3 questions
#    Actual: 3 separate calls
```

**Debugging steps**:

1. **Открой trace** для TC2
2. **Check tool calls**: Сколько раз вызван `ask_clarification`?
   - Видишь 3 отдельных вызова → проблема в промпте
3. **Inspect system prompt**:
   - Есть ли "Ask ALL questions in ONE batch"?
   - Добавь: "CRITICAL: Use ask_clarification ONCE with array of questions"
4. **Re-run**: Verify что теперь 1 вызов с массивом

### Сценарий 3: Token usage слишком высокий

```bash
# Opik UI shows:
# Input tokens: 8000
# Output tokens: 500
# Total cost: $0.05 per call
```

**Debugging steps**:

1. **Inspect input tokens**:
   - System prompt слишком длинный? → Сократи
   - История чата включена? → Убедись что используешь checkpointing правильно
2. **Inspect output tokens**:
   - Agent генерирует длинные ответы? → Добавь "Be concise" в prompt
3. **Оптимизируй**:
   - Убери лишние примеры из prompt
   - Используй `maxOutputTokens: 1024` вместо 2048

---

## 🐛 Troubleshooting

### "Connection refused localhost:5173"

**Проблема**: Opik не запущен

**Решение**:
```bash
cd opik
./opik.sh

# Verify running
docker ps | grep opik
# Should show: opik-frontend, opik-backend, postgres, redis
```

### "Traces not appearing in UI"

**Проблема**: Неправильная конфигурация или задержка

**Решение**:
```bash
# 1. Check .env
echo $OPIK_URL_OVERRIDE
# Should be: http://localhost:5173/api

# 2. Verify tags in code
# traceMetadata: { tags: ["cold-start"] }  // Required!

# 3. Wait 5-10 seconds (async ingestion)
# Then refresh browser

# 4. Check console для errors
docker logs opik-backend-1
```

### "UI shows empty project"

**Проблема**: Traces еще не ingested или фильтр неправильный

**Решение**:
- Wait 5-10 sec после теста (async ingestion)
- Refresh browser
- Check filter: убедись что tags совпадают
- Check console: `docker logs opik-backend-1`

### "trackGemini is not a function"

**Проблема**: Неправильный импорт или версия пакета

**Решение**:
```bash
# Verify installation
npm list opik-gemini
# Should be: opik-gemini@1.0+ (NOT 0.x!)

# Reinstall if needed
npm install opik-gemini@latest

# Check import
import { trackGemini } from 'opik-gemini';  // ✅ Правильно
import trackGemini from 'opik-gemini';      // ❌ Неправильно
```

### "TypeError: model.generate is not a function"

**Проблема**: Wrap неправильный тип модели

**Решение**:
```typescript
// ✅ ПРАВИЛЬНО - wrap genAI.getGenerativeModel
import { GoogleGenerativeAI } from "@google/generative-ai";
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const trackedModel = trackGemini(genAI.getGenerativeModel({ ... }));

// ❌ НЕПРАВИЛЬНО - wrap ChatGoogleGenerativeAI
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
const trackedModel = trackGemini(new ChatGoogleGenerativeAI({ ... }));
```

---

## 📊 Demo/Presentation Use Case

### Почему Opik хорош для demo

1. **Профессиональный UI** - выглядит как production-ready система
2. **Trace visualization** - показывает сложность workflow
3. **Token metrics** - демонстрирует оптимизацию
4. **Tool calls** - видно как агент принимает решения

### Как подготовить demo

```bash
# 1. Запустить Opik
cd opik && ./opik.sh

# 2. Run несколько тестов для генерации traces
npm run test:integration -- cold-start

# 3. Открыть UI и подготовить фильтры
open http://localhost:5173
# Filter: tags contains "cold-start"
# Sort: by timestamp DESC

# 4. Показать в презентации:
#    - Trace timeline (multi-turn dialog)
#    - Tool calls (extract_contexts, ask_clarification)
#    - Token usage (efficiency)
#    - Latency (performance)
```

### Что показывать инвесторам

- **Trace timeline**: "Вот как наш агент собирает карьерную историю в multi-turn диалоге"
- **Tool calls**: "Агент сам решает когда задавать вопросы, когда извлекать контексты"
- **Batch questions**: "Мы оптимизировали UX - агент задает ВСЕ вопросы за раз, не раздражая пользователя"
- **Token usage**: "Мы следим за efficiency - каждый запрос стоит $0.001 вместо $0.05"

---

## 📚 Дополнительные материалы

- [Opik GitHub](https://github.com/comet-ml/opik)
- [Opik Docs](https://www.comet.com/docs/opik/)
- [opik-gemini Integration](https://www.comet.com/docs/opik/tracing/integrations/gemini/)
- [WayMates: Opik Deep Dive](../../../docs/architecture/facade/llm-observability-deep-dive.md)
- [WayMates: Opik Practical Value](../../../docs/architecture/facade/opik-practical-value-waymates.md)

---

**Последнее обновление**: 2025-11-23
**Проверено на**: WayMates project, Gemini 2.0 Flash, cold-start workflow
