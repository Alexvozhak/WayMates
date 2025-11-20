# Промпт для Codex AI: Исправление тестов после масштабного рефакторинга архитектуры

## Контекст проекта
Проект WayMates - это Neo4j-приложение с MCP сервером для поиска совместимых пользователей. Проект использует TypeScript, Zod для валидации, и имеет комплексную тестовую инфраструктуру.

## Полная история рефакторинга (6 коммитов)

### Коммит 1: c0823dd - "chore: refactor search orchestration - unify SearchManager and QueryOrchestrator"
**Дата:** 12 октября 2025, 02:54:41
**Изменения:** 25 файлов, +941 -1228 строк

**Ключевые изменения:**
- **Удалены файлы:** `src/search-modes/current-only.ts`, `src/search-modes/current-to-target.ts`, `src/search-modes/target-only.ts`, `src/search-modes/target-search.ts`, `src/orcestrator/selectivity-profiler.ts`
- **Переименован:** `src/orcestrator/selectivity-profiler.ts` → `src/orcestrator/selector.ts`
- **Создан:** `src/search-manager.ts`
- **Обновлены:** `src/orcestrator/query-orchestrator.ts`, `src/schemas-zod.ts`, `src/mcp-server.ts`
- **Удалены тесты:** `tests/unit/field-snippets.test.ts`, `tests/unit/search-modes/current-to-target.test.ts`, `tests/unit/selectivity-profiler.test.ts`

### Коммит 2: 5f3abeb - "refactor: separate driver creation and connection validation"
**Дата:** 12 октября 2025, 03:30:13
**Изменения:** 2 файла, +21 -9 строк

**Ключевые изменения:**
- Разделение создания драйвера и проверки соединения в `src/neo4j.ts`
- Обновление инициализации в `src/app.ts`

### Коммит 3: ddf8d7e - "refactor: implement SearchQueryBuilder and persistence manager"
**Дата:** 12 октября 2025, 13:55:53
**Изменения:** 6 файлов, +99 -77 строк

**Ключевые изменения:**
- **Переименован:** `src/orcestrator/query-orchestrator.ts` → `src/orcestrator/search-query-builder.ts`
- **Создан:** `src/persistence-manager.ts`
- Обновлены `src/app.ts`, `src/mcp-server.ts`, `src/orcestrator/cypher-builder.ts`

### Коммит 4: d33ced1 - "fix: add --wait to docker:prod:up for start script readiness"
**Дата:** 12 октября 2025, 13:59:08
**Изменения:** 1 файл, +1 -1 строка

**Ключевые изменения:**
- Добавлен `--wait` в `package.json` для `docker:prod:up`

### Коммит 5: 03afca7 - "chore: add healthcheck to neo4j-prod and force recreate for --wait"
**Дата:** 12 октября 2025, 14:01:27
**Изменения:** 2 файла, +16 -1 строка

**Ключевые изменения:**
- Добавлен healthcheck в `docker-compose.yml`
- Обновлен `package.json`

### Коммит 6: 0d60103 - "refactor: enhance persistence management and query execution"
**Дата:** 12 октября 2025, 15:35:05
**Изменения:** 10 файлов, +315 -404 строк

**Ключевые изменения:**
- **Удален:** `src/mcp-tools.ts` (292 строки)
- **Создан:** `src/persistence-query-builder.ts`
- **Обновлены:** `src/persistence-manager.ts`, `src/schemas-zod.ts`, `src/neo4j.ts`
- Удалены функции `validateSchema` и `isValidSchema`
- Добавлены `withReadSession` и `withWriteSession` хелперы

## Итоговые изменения архитектуры

### 1. Масштабный рефакторинг архитектуры
- **Переименование**: `QueryOrchestrator` → `SearchQueryBuilder`
- **Новая архитектура**: Разделение на `SearchManager` (поиск) и `PersistenceManager` (запись)
- **Удаленные файлы**: 
  - `src/mcp-tools.ts` (292 строки)
  - `src/upsert-story.ts` 
  - `src/orcestrator/query-orchestrator.ts`
  - `src/search-modes/current-only.ts`
  - `src/search-modes/current-to-target.ts`
  - `src/search-modes/target-only.ts`
  - `src/search-modes/target-search.ts`
  - `src/orcestrator/selectivity-profiler.ts`
- **Новые файлы**: 
  - `src/persistence-query-builder.ts`
  - `src/persistence-manager.ts` 
  - `src/search-manager.ts`
  - `src/orcestrator/selector.ts` (переименован из selectivity-profiler.ts)

### 2. Изменения в схемах данных
- **Новые поля в RPC схемах**: `currentPreset`, `targetPreset`, `currentUserId`, `searchConstraints`
- **Унификация**: `SearchResultSchema` для всех типов поиска
- **Удаление**: `validateSchema` и `isValidSchema` функций (заменены на `zod.parse()`)

### 3. Изменения в API
- **SearchQueryBuilder**: Теперь только строит Cypher запросы, не выполняет их
- **SearchManager**: Выполняет поисковые запросы через `withReadSession`
- **PersistenceManager**: Выполняет операции записи через `withWriteSession`
- **MCP Server**: Обновлен для использования новых менеджеров

## Проблемы, которые нужно исправить

### 1. Удаленные тесты (нужно восстановить или адаптировать)
**Полностью удаленные файлы тестов:**
- `tests/unit/field-snippets.test.ts` (223 строки)
- `tests/unit/search-modes/current-to-target.test.ts` (133 строки) 
- `tests/unit/selectivity-profiler.test.ts` (72 строки)

**Статус:** Эти тесты были удалены в коммите c0823dd, но их функциональность может быть нужна

### 2. Тесты с устаревшими импортами
**Файлы с проблемами:**
- `tests/unit/orcestrator/cypher-builder.test.ts`
- `tests/unit/orcestrator/snippets-extractor.test.ts`
- `tests/functional/search-algorithms.test.ts`
- `tests/functional/selectivity-profiler.test.ts`
- `tests/integration/field-snippets.test.ts`
- `tests/integration/orcestrator/query-orchestrator.test.ts`

**Проблемы:**
- Импорты из удаленных файлов (`src/orcestrator/query-orchestrator.ts`, `src/mcp-tools.ts`)
- Использование устаревших функций (`validateSchema`, `isValidSchema`)
- Обращения к несуществующим методам

### 3. Тесты с устаревшими сигнатурами функций
**Проблемы:**
- Функции `executeCurrentToTarget`, `executeCurrentOnly`, `executeTargetOnly` теперь принимают `orchestrator` вместо `driver`
- Изменились параметры функций (добавлены `presetOptions`, `searchConstraints`)
- Обновлены RPC схемы с новыми полями

### 4. Тесты с устаревшими ожиданиями
**Проблемы:**
- Ожидания в Cypher строках не соответствуют новым именам переменных
- Изменилась структура возвращаемых данных
- Обновлены схемы валидации

## Задание для Codex AI

### Цель
Исправить все падающие тесты после архитектурного рефакторинга, приведя их в соответствие с новой архитектурой.

### Что нужно сделать

#### 1. Восстановить удаленные тесты
**Приоритет:** Высокий
**Файлы для восстановления:**
- `tests/unit/field-snippets.test.ts` - тесты для извлечения полей контекста
- `tests/unit/search-modes/current-to-target.test.ts` - тесты для режима current-to-target
- `tests/unit/selectivity-profiler.test.ts` - тесты для профилирования селективности

**Действия:**
- Восстановить файлы из git истории (коммит до c0823dd)
- Адаптировать под новую архитектуру
- Обновить импорты и вызовы функций

#### 2. Обновить импорты
```typescript
// Было:
import { QueryOrchestrator } from "../src/orcestrator/query-orchestrator.js";
import { validateSchema } from "../src/schemas-zod.js";

// Должно быть:
import { SearchQueryBuilder } from "../src/orcestrator/search-query-builder.js";
// validateSchema больше не нужен, используй schema.parse()
```

#### 3. Обновить создание объектов
```typescript
// Было:
const orchestrator = new QueryOrchestrator(driver, presetsManager);

// Должно быть:
const searchQueryBuilder = new SearchQueryBuilder(presetsManager);
const searchManager = new SearchManager(driver, searchQueryBuilder);
```

#### 4. Обновить вызовы функций
```typescript
// Было:
const result = await executeCurrentToTarget(driver, params);

// Должно быть:
const result = await executeCurrentToTarget(searchManager, params);
```

#### 5. Обновить валидацию данных
```typescript
// Было:
const isValid = validateSchema(SomeSchema, data);

// Должно быть:
try {
  const parsed = SomeSchema.parse(data);
  // использовать parsed
} catch (error) {
  // обработать ошибку
}
```

#### 6. Обновить ожидания в тестах
- Проверить, что Cypher строки содержат правильные имена переменных
- Обновить ожидаемые структуры данных согласно новым схемам
- Убедиться, что тесты проверяют правильные поля

### Файлы для исправления (приоритет)

1. **Критический приоритет (восстановить):**
   - `tests/unit/field-snippets.test.ts` - восстановить из git истории
   - `tests/unit/search-modes/current-to-target.test.ts` - восстановить из git истории
   - `tests/unit/selectivity-profiler.test.ts` - восстановить из git истории

2. **Высокий приоритет (исправить импорты):**
   - `tests/unit/orcestrator/cypher-builder.test.ts`
   - `tests/unit/orcestrator/snippets-extractor.test.ts`
   - `tests/integration/orcestrator/query-orchestrator.test.ts`

3. **Средний приоритет:**
   - `tests/functional/search-algorithms.test.ts`
   - `tests/functional/selectivity-profiler.test.ts`
   - `tests/integration/field-snippets.test.ts`

### Ожидаемый результат
- Все тесты проходят без ошибок
- Тесты соответствуют новой архитектуре
- Код чистый, без устаревших импортов
- Валидация данных использует `zod.parse()` вместо `validateSchema`

### Дополнительные заметки
- Проект использует Vitest для тестирования
- Все тесты должны работать с реальной Neo4j БД (интеграционные и функциональные)
- Не создавать моки для тестирования - использовать реальные данные
- Следовать принципам DRY в тестах
- При сомнениях в логике тестов - подсветить проблему и спросить, что исправлять

## Команды для восстановления и проверки

### Восстановление удаленных тестов
```bash
# Восстановить удаленные тесты из коммита до рефакторинга
git show c0823dd~1:tests/unit/field-snippets.test.ts > tests/unit/field-snippets.test.ts
git show c0823dd~1:tests/unit/search-modes/current-to-target.test.ts > tests/unit/search-modes/current-to-target.test.ts
git show c0823dd~1:tests/unit/selectivity-profiler.test.ts > tests/unit/selectivity-profiler.test.ts

# Создать директорию для search-modes тестов
mkdir -p tests/unit/search-modes
```

### Проверка тестов
```bash
# Запуск всех тестов
npm test

# Запуск только unit тестов
npm run test:unit

# Запуск только интеграционных тестов
npm run test:integration

# Запуск только функциональных тестов
npm run test:functional
```

## Структура проекта

### Текущая структура (после рефакторинга)
```
src/
├── orcestrator/
│   ├── search-query-builder.ts  # (бывший query-orchestrator.ts)
│   ├── cypher-builder.ts
│   ├── snippets-extractor.ts
│   └── selector.ts              # (бывший selectivity-profiler.ts)
├── search-manager.ts            # новый
├── persistence-manager.ts       # новый
├── persistence-query-builder.ts # новый
├── schemas-zod.ts
└── mcp-server.ts

tests/
├── unit/
│   ├── orcestrator/
│   └── search-modes/            # нужно восстановить
├── integration/
└── functional/
```

### Удаленные файлы (нужно восстановить)
```
tests/unit/
├── field-snippets.test.ts       # УДАЛЕН - нужно восстановить
├── selectivity-profiler.test.ts # УДАЛЕН - нужно восстановить
└── search-modes/
    └── current-to-target.test.ts # УДАЛЕН - нужно восстановить

src/ (удаленные)
├── mcp-tools.ts                 # УДАЛЕН - функциональность перенесена
├── upsert-story.ts              # УДАЛЕН - функциональность перенесена
├── search-modes/                # УДАЛЕН - функциональность перенесена
│   ├── current-only.ts
│   ├── current-to-target.ts
│   ├── target-only.ts
│   └── target-search.ts
└── orcestrator/
    └── selectivity-profiler.ts  # ПЕРЕИМЕНОВАН в selector.ts
```

Удачи в исправлении тестов! 🚀
