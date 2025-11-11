# Code Quality Rules

## Принятые правила (помимо ESLint)

### 1. Функции должны быть явными и предсказуемыми
**Что**: Никаких "умных" трюков, скрытого поведения, магии.

**Почему**: Код должен читаться как книга, без сюрпризов.

**Пример** (плохо):
```typescript
// ❌ Неявное поведение
function getUser(id?: string) {
  return id ?? getCurrentUser();  // Скрытый fallback
}
```

**Пример** (хорошо):
```typescript
// ✅ Явное поведение
function getUserById(id: string) { /* ... */ }
function getCurrentUser() { /* ... */ }
```

---

### 2. Максимум 2 уровня вложенности (max-depth: 2)
**Что**: Если больше 2 уровней - рефакторь в подфункции.

**Почему**: Читаемость, тестируемость.

**Пример** (плохо):
```typescript
// ❌ 3 уровня вложенности
if (user) {
  if (user.contexts.length > 0) {
    for (const ctx of user.contexts) {
      // ...
    }
  }
}
```

**Пример** (хорошо):
```typescript
// ✅ Рефакторинг в функции
if (!user || user.contexts.length === 0) return;
processUserContexts(user.contexts);
```

---

### 3. Cyclomatic Complexity ≤ 8 (complexity: 8)
**Что**: Не больше 8 путей выполнения в функции.

**Почему**: Простота понимания, тестирования.

**Пример** (плохо):
```typescript
// ❌ Complexity = 12
function validate(data) {
  if (data.a && data.b || data.c) { /* ... */ }
  if (data.d) { /* ... */ } else if (data.e) { /* ... */ }
  // ...
}
```

**Пример** (хорошо):
```typescript
// ✅ Разбить на подфункции
function validate(data) {
  validatePrimary(data);
  validateSecondary(data);
}
```

---

### 4. Функции ≤ 60 строк (max-lines-per-function: 60)
**Что**: Если функция > 60 строк - рефакторь.

**Почему**: Легче понять, тестировать, переиспользовать.

**Исключение**: Integration tests (отключено правило для `tests/**/*.ts`).

---

### 5. Explicit return types (typescript-eslint/explicit-function-return-type)
**Что**: Все функции должны иметь явный тип возврата.

**Почему**: Самодокументация, type safety.

**Пример** (плохо):
```typescript
// ❌ Неявный тип
function getUser(id: string) {
  return db.findUser(id);  // Какой тип вернётся?
}
```

**Пример** (хорошо):
```typescript
// ✅ Явный тип
function getUser(id: string): User | null {
  return db.findUser(id);
}
```

**Исключение**: Tests (отключено для `tests/**/*.ts`).

---

### 6. CamelCase naming (naming-convention)
**Что**: Все TypeScript переменные, функции, свойства - camelCase.

**Почему**: JavaScript idiom, консистентность.

**Исключения**:
- MCP tool names - snake_case (стандарт MCP)
- Const enums - UPPER_CASE

---

### 7. Type-first imports (import-x/order)
**Что**: `import type` должны идти перед обычными imports.

**Почему**: Ясность зависимостей, лучшая tree-shaking.

**Пример**:
```typescript
// ✅ Правильный порядок
import type { Context, Trail } from './schemas.js';
import { z } from 'zod';
import { db } from './db.js';
```

---

### 8. Sorted imports (import-x/order)
**Что**: Импорты сортируются по группам: builtin → external → internal → parent → sibling → index.

**Почему**: Консистентность, легче найти импорт.

**Автофикс**: `npm run lint -- --fix`

---

### 9. Prefer immutable operations (unicorn/prefer-*)
**Что**: Используй immutable методы где возможно (`.toSorted()`, `.toSpliced()`, `.with()`).

**Почему**: Меньше side effects, предсказуемость.

**Пример**:
```typescript
// ❌ Мутирует оригинал
const sorted = array.sort();

// ✅ Immutable
const sorted = array.toSorted();
```

---

### 10. No default exports (import-x/no-default-export)
**Что**: Используй named exports вместо default.

**Почему**: Лучше tree-shaking, рефакторинг, IDE support.

**Исключения**:
- `vitest.config.ts` (требование Vitest)
- `eslint.config.mjs` (требование ESLint)

---

### 11. Type over interface (typescript-eslint/consistent-type-definitions)
**Что**: Используй `type` вместо `interface` для type definitions.

**Почему**: Консистентность в project-specific code style, композиция через `&` проще чем `extends`.

**Пример** (плохо):
```typescript
// ❌ Interface
interface User {
  id: string;
  name: string;
}
```

**Пример** (хорошо):
```typescript
// ✅ Type
type User = {
  id: string;
  name: string;
};
```

**Контекст**: Правило добавлено как override для TypeScript preset `tseslint.configs.stylistic`, который по умолчанию требует `interface`.

---

## Readability Preferences

### User feedback quotes:
- **"как то грязно inline тип ты предлагаешь"** - избегай inline type annotations, используй file-based config
- **"если функция не используется то почему просто её не удалить?"** - удаляй unused код сразу
- **"определись, в соседней сессии ты уверял, что нужен camelcase"** - будь последователен в решениях

### Code style:
- **Explicit > clever** - ясность важнее краткости
- **No nested ternaries** - используй if/else для читаемости
- **Descriptive variable names** - isFirst, isLast лучше чем i === 0
- **Formula-first для math** - математические операции явно, не скрыто

**См. Memory MCP**: `Code Readability Preference`

---

## Правила для Cypher

См. [../project-state/cypher.md](../project-state/cypher.md) и [cypher-mistakes.md](cypher-mistakes.md).

---

*Last updated: 2025-11-11*
