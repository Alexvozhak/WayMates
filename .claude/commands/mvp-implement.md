---
name: mvp-implement
description: Реализация для MVP — написание кода по согласованному дизайну. Строго по спецификации, без импровизаций.
model: opus
---

# MVP Implement — Подкоманда реализации

> **Роль**: Исполнитель — реализовать согласованный дизайн
> **Вызывается из**: `/mvp-release` или после `/mvp-design`
> **Переход к**: `/mvp-test` (после реализации)

Ты реализуешь код для MVP. Твоя задача — написать код СТРОГО по согласованному дизайну, без отступлений.

---

## 🔍 Дополнительный контекст (загрузить при старте)

```bash
# Базовый контекст уже загружен из /mvp-release
# Дополнительно для реализации:

# 1. ESLint конфигурация (ОБЯЗАТЕЛЬНО)
Read eslint.config.mjs

# 2. Vitest конфигурация
Read vitest.config.ts

# 3. Существующие паттерны кода
# Посмотреть похожие файлы в том же модуле
```

---

## 🧠 Алгоритм реализации

### 1. Проверить входные данные

**Обязательно должен быть:**
- Согласованный дизайн (types, API, file structure)
- Понимание integration points
- Оценка LOC

**Если дизайна нет — СТОП:**
```
Дизайн не согласован. Нужно сначала `/mvp-design`.
Что проектируем?
```

### 2. Подготовка к реализации

**Checklist перед кодом:**
- [ ] Дизайн согласован (types, API)
- [ ] Понятен file structure
- [ ] Проверены eslint constraints (max-lines, complexity)
- [ ] Понятны integration points

### 3. Реализация

**Порядок:**
1. Types/interfaces (если в отдельном файле)
2. Основная логика (по функциям из дизайна)
3. Exports

**Правила кода:**
```typescript
// ✅ ПРАВИЛЬНО
import type { UserId } from '../../shared/schemas.js';
import { logger } from '../../shared/logger.js';

export type Config = { /* ... */ };

export function mainFunction(param: Config): Result {
  // реализация
}

// ❌ НЕПРАВИЛЬНО
import { type UserId, logger } from '...';  // смешанные импорты
export default function() { /* ... */ };     // default export
const any: any = {};                         // any тип
```

### 4. Проверка качества

**После каждого логического блока:**
```bash
npm run lint
npx tsc --noEmit
```

**НЕ спамить проверками!** Только после завершения логического блока.

### 5. Checkpoint

**После реализации — показать результат:**
```markdown
## Implementation Complete

### Созданные файлы
- src/shared/rate-limiter.ts (42 LOC)

### Exports
- `globalLimiter: Bottleneck`
- `getUserLimiter(userId): Bottleneck`
- `rateLimitedCall<T>(userId, op, fn): Promise<T>`

### Quality Gates
- ✅ lint: 0 errors
- ✅ tsc: 0 errors

### Следующий шаг
Нужны тесты? → `/mvp-test`
```

---

## 📋 Eslint Constraints (помнить!)

| Правило | Лимит | Что делать |
|---------|-------|------------|
| max-lines-per-function | 60 | Разбивать на helper functions |
| max-depth | 2 | Early return, guard clauses |
| complexity | 8 | Упрощать логику, выносить |

**Пример рефакторинга глубины:**
```typescript
// ❌ Глубина 3
function process(data) {
  if (data) {
    if (data.items) {
      for (const item of data.items) {
        // depth 3
      }
    }
  }
}

// ✅ Глубина 2
function process(data) {
  if (!data?.items) return;

  for (const item of data.items) {
    processItem(item);  // вынесли
  }
}
```

---

## 🚫 ЗАПРЕТЫ

| # | Запрет | Вместо этого |
|---|--------|--------------|
| 1 | Код без дизайна | Сначала `/mvp-design` |
| 2 | Отступление от дизайна | Обсудить изменения |
| 3 | `any` типы | Явные типы |
| 4 | `export default` | Named exports |
| 5 | Смешанные импорты | `import type` отдельно |
| 6 | Функции > 60 LOC | Разбивать |
| 7 | Глубина > 2 | Early return |
| 8 | Спам lint/tsc | Только после блока |
| 9 | Импровизация | Строго по дизайну |

---

## ✅ Критерии завершения реализации

- [ ] Код соответствует дизайну (types, API)
- [ ] lint: 0 errors
- [ ] tsc: 0 errors
- [ ] Файлы в правильных местах
- [ ] Exports соответствуют дизайну
- [ ] LOC в пределах оценки (±20%)

---

## 🔄 Переход к тестированию

**После реализации:**

```markdown
Реализация завершена ✅

- Файл: src/shared/rate-limiter.ts (42 LOC)
- lint: ✅
- tsc: ✅

Нужны тесты для этого модуля?
Переходим к `/mvp-test`?

Scope для test:
- Unit tests: rate-limiter.spec.ts
- Что тестировать: getUserLimiter, rateLimitedCall
```

---

## 💡 Шаблон реализации

```typescript
/**
 * Rate Limiter для LLM вызовов
 *
 * @module rate-limiter
 * @see Design: согласован YYYY-MM-DD
 */

import type { UserId } from '../../shared/schemas.js';
import Bottleneck from 'bottleneck';

// === Types ===

export type RateLimitConfig = {
  maxConcurrent: number;
  minTime: number;
  reservoir?: number;
  reservoirRefreshInterval?: number;
};

// === Constants ===

const DEFAULT_CONFIG: RateLimitConfig = {
  maxConcurrent: 10,
  minTime: 100,
  reservoir: 100,
  reservoirRefreshInterval: 60_000,
};

// === State ===

const userLimiters = new Map<UserId, Bottleneck>();

// === Public API ===

export const globalLimiter = new Bottleneck(DEFAULT_CONFIG);

export function getUserLimiter(userId: UserId): Bottleneck {
  let limiter = userLimiters.get(userId);

  if (!limiter) {
    limiter = new Bottleneck({ maxConcurrent: 5, minTime: 200 });
    userLimiters.set(userId, limiter);
  }

  return limiter;
}

export async function rateLimitedCall<T>(
  userId: UserId,
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  const userLimiter = getUserLimiter(userId);

  return globalLimiter.schedule(() =>
    userLimiter.schedule(fn)
  );
}
```

---

## 🔧 Частые паттерны

### Guard Clauses (уменьшить глубину)

```typescript
// ✅ Guard clause
function process(data: Data | null): Result {
  if (!data) {
    return { error: 'No data' };
  }

  // основная логика на глубине 1
  return { success: true };
}
```

### Extract Helper (уменьшить LOC)

```typescript
// ✅ Вынести в helper
function mainFunction(items: Item[]): Result[] {
  return items.map(processItem);
}

function processItem(item: Item): Result {
  // логика обработки одного item
}
```

### Type Narrowing (вместо any)

```typescript
// ✅ Type guard
function isValidResponse(data: unknown): data is ValidResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    'status' in data
  );
}
```

---

## ⚠️ Важно

1. **Строго по дизайну** — не импровизировать
2. **ESLint first** — учитывать constraints при написании
3. **Checkpoint после блока** — показать результат
4. **Не спамить проверками** — lint/tsc после логического блока
5. **Готовность к тестам** — код должен быть testable
