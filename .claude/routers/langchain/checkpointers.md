# LangChain v1.0 Checkpointers

**Зачем**: Persistence для агентов, сохранение state между вызовами, resume после прерываний.

---

## 🐘 PostgresSaver Setup

### Установка
```bash
npm install @langchain/langgraph-checkpoint-postgres pg
```

### Базовая конфигурация
```typescript
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";

// Вариант 1: Connection string
const checkpointer = PostgresSaver.fromConnString(
  "postgresql://user:password@localhost:5432/waymates",
  {
    schema: "checkpoints" // Optional, default: public
  }
);

// Вариант 2: pg Pool
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

### Использование с агентом
```typescript
const agent = createAgent({
  model: "models/gemini-2.0-flash",
  tools: [...],
  checkpointer, // Включаем persistence
  // ...
});

// Invoke с thread_id для сохранения state
const result = await agent.invoke(
  { messages: [...] },
  {
    configurable: {
      thread_id: "session-123" // Ключ для checkpoint
    }
  }
);
```

---

## 🧹 Cleanup Strategies

### Проблема: Unbounded Growth
PostgresSaver создает **~100 rows per workflow**. Без очистки = быстрый рост БД.

### Стратегия 1: pg_cron
```sql
-- Установка pg_cron
CREATE EXTENSION pg_cron;

-- Удаление старых checkpoints каждый день в 3:00
SELECT cron.schedule('cleanup-checkpoints', '0 3 * * *',
  $$DELETE FROM checkpoints
    WHERE created_at < NOW() - INTERVAL '7 days'$$
);

-- Проверка задач
SELECT * FROM cron.job;
```

### Стратегия 2: Партиционирование
```sql
-- Создаем партиционированную таблицу
CREATE TABLE checkpoints_partitioned (
  LIKE checkpoints INCLUDING ALL
) PARTITION BY RANGE (created_at);

-- Создаем партиции по дням
CREATE TABLE checkpoints_2025_11_19
  PARTITION OF checkpoints_partitioned
  FOR VALUES FROM ('2025-11-19') TO ('2025-11-20');

-- Автоматическое создание партиций через pg_partman
CREATE EXTENSION pg_partman;
SELECT partman.create_parent(
  p_parent_table => 'public.checkpoints_partitioned',
  p_control => 'created_at',
  p_type => 'range',
  p_interval => 'daily'
);
```

### Стратегия 3: Application-level cleanup
```typescript
// Cleanup service
class CheckpointCleaner {
  async cleanOldCheckpoints(days = 7) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    await pool.query(
      `DELETE FROM checkpoints
       WHERE created_at < $1`,
      [cutoff]
    );
  }
}

// Запускаем периодически
setInterval(() => {
  cleaner.cleanOldCheckpoints(7);
}, 24 * 60 * 60 * 1000); // Каждый день
```

---

## 🚀 WayMates Configuration

### Development
```typescript
// dev.config.ts
export const devCheckpointer = PostgresSaver.fromConnString(
  "postgresql://postgres:password@localhost:5432/waymates_dev",
  { schema: "checkpoints_dev" }
);
```

### Production
```typescript
// prod.config.ts
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Connection pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  ssl: {
    rejectUnauthorized: false // For Heroku/Render
  }
});

export const prodCheckpointer = new PostgresSaver(pool);

// С автоматической очисткой
async function setupProduction() {
  await prodCheckpointer.setup();

  // Настраиваем очистку
  await pool.query(`
    SELECT cron.schedule('cleanup-checkpoints', '0 3 * * *',
      $$DELETE FROM checkpoints
        WHERE created_at < NOW() - INTERVAL '7 days'
        AND thread_id NOT IN (
          SELECT DISTINCT thread_id
          FROM checkpoints
          WHERE created_at > NOW() - INTERVAL '1 day'
        )$$
    );
  `);
}
```

---

## 📊 Оптимизация производительности

### Индексы
```sql
-- Основные индексы (создаются автоматически при setup())
CREATE INDEX idx_checkpoints_thread_id ON checkpoints(thread_id);
CREATE INDEX idx_checkpoints_created_at ON checkpoints(created_at);

-- Дополнительные для оптимизации
CREATE INDEX idx_checkpoints_thread_created
  ON checkpoints(thread_id, created_at DESC);
```

### Connection Pooling
```typescript
const pool = new Pool({
  max: 20,                    // Максимум соединений
  min: 5,                     // Минимум соединений
  idleTimeoutMillis: 30000,   // Закрыть idle после 30 сек
  connectionTimeoutMillis: 2000 // Таймаут на подключение
});
```

### Мониторинг
```sql
-- Размер таблицы checkpoints
SELECT
  pg_size_pretty(pg_total_relation_size('checkpoints')) as total_size,
  COUNT(*) as row_count,
  COUNT(DISTINCT thread_id) as unique_threads
FROM checkpoints;

-- Старые checkpoints для очистки
SELECT
  DATE(created_at) as date,
  COUNT(*) as checkpoints,
  COUNT(DISTINCT thread_id) as threads
FROM checkpoints
WHERE created_at < NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

---

## ⚠️ Важные моменты

1. **setup() обязателен**: Вызывай при первом запуске для создания таблиц
2. **thread_id уникальность**: Используй UUID или составные ключи
3. **Cleanup обязателен**: Иначе БД быстро растет (100 rows per workflow)
4. **Connection pool**: Переиспользуй для всех агентов
5. **Monitoring**: Следи за размером таблицы checkpoints