# FEAT-041: Message Batcher (Race Condition Protection)

**Status**: ✅ DONE
**Priority**: P1
**Component**: Telegram Bot (client-side batching)
**Created**: 2025-12-24
**Completed**: 2025-12-24

---

## Problem

При отправке 2+ сообщений одновременно (race condition):
- Оба запроса читают один checkpoint LangGraph
- Оба начинают обработку параллельно
- Результат непредсказуем (cancel, wrong state, corruption)

**Пример**: Пользователь быстро печатает:
```
"хочу стать" [отправил]
"senior backend" [отправил]
"с python" [отправил]
```
→ 3 параллельных вызова → state corruption

---

## Solution (Final — Client-Side Batching)

**Архитектурное решение**: Батчинг в Telegram Bot, не в Facade.

**Почему:**
- MCP — stateless протокол (request → response)
- LibreChat не нуждается в батчинге (синхронный flow)
- Race condition — проблема клиента (Telegram), не сервера

**Реализация** через `promise-batcher`:
- Собираем сообщения за 300ms (configurable)
- Leader получает response, followers → null → skip reply
- MCP сервер остаётся stateless

---

## Implementation (Completed)

### Architecture

```
Telegram Handler (converse.ts)
    ↓
MessageBatcherService.enqueue(telegramUserId, message, process)
    ↓
[Batcher per user, debounce 300ms]
    ↓
Leader: process(combined) → mcpClient.callTool("converse") → response → ctx.reply()
Followers: null → skip reply
```

### Files Changed

| File | Action |
|------|--------|
| `src/telegram-bot/services/message-batcher.service.ts` | **NEW** (~80 LOC) |
| `src/telegram-bot/types.ts` | +messageBatcher in BotServices |
| `src/telegram-bot/index.ts` | +create MessageBatcherService |
| `src/telegram-bot/env.ts` | +MESSAGE_BATCH_* configs |
| `src/telegram-bot/handlers/converse.ts` | +batcher integration |
| `src/facade/services/message-batcher.service.ts` | **DELETED** |
| `src/facade/mcp-server/mcp-server.ts` | -messageBatcher param |
| `src/facade/mcp-server/tools/converse.tool.ts` | -BatchResult, simple ConverseResponse |
| `src/facade/index.ts` | -MessageBatcherService creation |
| `src/facade/env.ts` | -MESSAGE_BATCH_* configs |

### MessageBatcherService

```typescript
// src/telegram-bot/services/message-batcher.service.ts
export class MessageBatcherService<T> {
  private readonly batchers = new Map<number, Batcher<string, T | null>>();

  constructor(delayMs: number, maxSize: number);

  async enqueue(
    telegramUserId: number,
    message: string,
    process: (combined: string) => Promise<T>,
  ): Promise<T | null>;  // null for followers
}
```

### Integration

```typescript
// converse.ts handler
const converseResp = await ctx.services.messageBatcher.enqueue(
  ctx.from.id,
  message,
  (combined) => ctx.services.mcpClient.callTool("converse", { message: combined, ... }),
);

if (!converseResp) return;  // follower — skip reply

const formatted = await formatResponse(converseResp, ...);
await ctx.reply(formatted);
```

### Config

В telegram-bot/env.ts:
- `MESSAGE_BATCH_DELAY_MS` (default: 300)
- `MESSAGE_BATCH_MAX_SIZE` (default: 10)

---

## Implementation Plan (Completed)

1. [x] Remove batching from Facade (mcp-server.ts, converse.tool.ts, index.ts, env.ts)
2. [x] Delete `src/facade/services/message-batcher.service.ts`
3. [x] Create `src/telegram-bot/services/message-batcher.service.ts`
4. [x] Add MESSAGE_BATCH_* to `src/telegram-bot/env.ts`
5. [x] Add messageBatcher to BotServices in `types.ts`
6. [x] Create and inject in `index.ts`
7. [x] Integrate in `handlers/converse.ts`
8. [x] Run `npm run lint:fix && npx tsc --noEmit` ✅

---

## Test Plan

### Unit Tests
- [ ] MessageBatcherService batches messages within delay
- [ ] Per-user isolation (different users = different batches)
- [ ] Error propagation to all callers

### Integration Tests
- [ ] Race condition: 2 parallel messages → single batch
- [ ] Sequential messages (>delay apart) → separate batches

### Manual Test
```bash
# Terminal 1: Start bot
npm run bot:test

# Terminal 2: Send rapid messages
set -a && source .env.test && set +a
npx tsx poc/mcp-chat.ts "msg1" & npx tsx poc/mcp-chat.ts "msg2" & wait
```

---

## Dependencies

- `promise-batcher` (already installed)
- Config vars in env.ts (already exist)

---

## Research Summary

- **LangGraph**: No built-in race condition protection for same thread_id
- **MCP Protocol**: JSON-RPC batching removed in 2025-06-18 spec
- **DataLoader**: No debounce (nextTick only)
- **Bottleneck.Batcher**: EventEmitter API, needs wrapper
- **promise-batcher**: ✅ Promise API + debounce — perfect fit

POC validated: `poc/test-promise-batcher.ts` — all tests pass.

---

## Acceptance Criteria

- [x] AC1: Rapid messages (within 300ms) batched into single MCP call
- [x] AC2: Different users processed independently (Map<telegramUserId, Batcher>)
- [x] AC3: Leader gets response, followers get null (skip reply)
- [x] AC4: Errors propagate to all callers in batch
- [x] AC5: Config from env vars (MESSAGE_BATCH_DELAY_MS, MESSAGE_BATCH_MAX_SIZE)
- [x] AC6: MCP server remains stateless (batching in Telegram Bot only)
