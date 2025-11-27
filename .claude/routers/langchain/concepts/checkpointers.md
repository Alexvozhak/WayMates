# Checkpointers - PostgresSaver

**Назначение**: Persistence для state между invocations + interrupts.

**Когда**: Всегда когда нужны interrupts или resume после перезапуска.

---

## Setup

```typescript
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { Pool } from "pg";

const pool = new Pool({
  host: "localhost",
  port: 5432,
  database: "waymates",
  user: "langchain",
  password: process.env.DB_PASSWORD
});

const checkpointer = new PostgresSaver(pool);

// ВАЖНО: Создать таблицы при первом запуске
await checkpointer.setup();
```

---

## Использование с agent

```typescript
const agent = createAgent({
  model: "models/gemini-2.0-flash",
  tools: [...],
  checkpointer // Подключаем checkpointer
});

// Invoke с thread_id для persistence
const config = {
  configurable: {
    thread_id: "session-123" // Ключ для checkpoint
  }
};

await agent.invoke({ messages: [...] }, config);
```

**ВАЖНО**: `thread_id` ОБЯЗАТЕЛЕН для persistence ([см. glossary](../glossary.md#thread-id-persistence)).

---

## Cleanup (ОБЯЗАТЕЛЬНО!)

**Проблема**: PostgresSaver создает ~100 rows per workflow → unbounded growth.

**Решение**: pg_cron для автоматической очистки.

```sql
-- Установка pg_cron
CREATE EXTENSION pg_cron;

-- Удаление старых checkpoints каждый день в 3:00
SELECT cron.schedule('cleanup-checkpoints', '0 3 * * *',
  $$DELETE FROM checkpoints
    WHERE created_at < NOW() - INTERVAL '7 days'$$
);
```

---

## WayMates Setup

**Production**: [infrastructure/postgres.service.ts](../../../../src/facade/infrastructure/postgres.service.ts)

```typescript
class PostgresService {
  private checkpointer: PostgresSaver | null = null;

  getCheckpointer(): PostgresSaver {
    if (!this.checkpointer) {
      this.checkpointer = new PostgresSaver(this.pool);
    }
    return this.checkpointer;
  }

  async setupCheckpointer(): Promise<void> {
    const checkpointer = this.getCheckpointer();
    await checkpointer.setup();
  }
}

export const postgresService = new PostgresService();
```

---

## См. также

- [glossary.md#postgressaver](../glossary.md#postgressaver) - API reference
- [concepts/human-in-loop.md](./human-in-loop.md) - Interrupts требуют checkpointer
- [checkpointers.md (old)](../checkpointers.md) - Подробности про cleanup strategies
