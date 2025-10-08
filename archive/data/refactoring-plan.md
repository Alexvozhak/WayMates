# 📋 Задание: Рефакторинг trailImport.test.ts

## 🎯 Цель
Разделить существующие тесты на три категории согласно принципам чистого тестирования и избежать дублирования между уровнями.

## 📁 Структура файлов после рефакторинга

```
tests/
├── unit/
│   └── upsert-story.test.ts              # Новый файл
├── integration/
│   └── database-operations.test.ts       # Переименованный trailImport.test.ts
└── functional/
    └── story-processing.test.ts           # Новый файл
```

## 🔧 Интеграционные тесты (`database-operations.test.ts`)

### Что оставить из текущих тестов:
- **"should create Platform and SkillPlatformNode relationships"** - проверка сложных связей в БД
- **"should handle trails with null to_context_id (ongoing trails)"** - проверка OPTIONAL MATCH в Cypher
- **"should create STEPS_ON relationships for trails"** - проверка корректности связей

### Что добавить (новые интеграционные тесты):
- **"Database constraints prevent duplicate trail IDs"**
- **"Cypher queries handle large datasets efficiently"** 
- **"Transaction rollback works on database errors"**
- **"Database indexes are used for trail queries"**

### Фокус интеграционных тестов:
- Работа с реальной Neo4j базой
- Корректность Cypher запросов
- Проверка схемы БД и связей
- Производительность запросов

---

## 🎨 Функциональные тесты (`story-processing.test.ts`)

### Что перевести из текущих тестов:
- **"should import StoryInput with trails from real data"** → `"processes complete user story end-to-end"`
- **"should create Trail nodes with correct properties"** → `"creates user profile with all trail data"`
- **"should import multiple trails from different users"** → `"handles multiple user stories correctly"`
- **"should import migrated JSON files successfully"** → `"processes real migrated data files"`

### Подход для функциональных тестов:
- Использовать `executeUpsertStory()` вместо прямых Cypher запросов
- Проверять бизнес-результат, а не детали реализации
- Тестировать полные пользовательские сценарии
- Проверять что данные можно найти через поисковые функции

### Примерная структура функциональных тестов:
```typescript
test("processes complete user story end-to-end", async () => {
  const storyData = loadTestData("USER_001");
  
  const result = await executeUpsertStory(driver, storyData);
  
  expect(result.success).toBe(true);
  expect(result.contextsCreated).toBe(3);
  // Проверяем что можем найти пользователя через поиск
});
```

---

## 🧪 Юнит-тесты (`upsert-story.test.ts`)

### Что создать (новые юнит-тесты):
- **"generateContextId creates valid ULID format"**
- **"generateTrailId produces unique IDs"**
- **"upsertContext validates input parameters"** (минимальные моки)
- **"executeUpsertStory handles empty arrays"**
- **"error messages contain useful information"**

### Принципы юнит-тестов:
- Тестировать только логику функций
- Минимальные моки (только для изоляции, не для всей БД)
- Быстрые тесты без реальной БД
- Фокус на edge cases и валидации

---

## ❌ Что удалить/не дублировать

### Убрать из интеграционных:
- **"should validate StoryInput schema before import"** - это не интеграционный тест
- Детальные проверки бизнес-логики (оставить только проверки БД)

### Не создавать в юнитах:
- Тесты с реальной БД
- Комплексные моки всей БД инфраструктуры
- Дублирование функциональных сценариев

---

## 🎯 Критерии успеха

### Интеграционные тесты должны:
- ✅ Использовать реальную Neo4j БД
- ✅ Проверять корректность Cypher запросов
- ✅ Тестировать сложные связи и ограничения БД
- ✅ Быть относительно медленными (секунды)

### Функциональные тесты должны:
- ✅ Использовать `executeUpsertStory()` как точку входа
- ✅ Тестировать полные пользовательские сценарии
- ✅ Проверять бизнес-результат, не детали реализации
- ✅ Использовать реальные тестовые данные

### Юнит-тесты должны:
- ✅ Быть очень быстрыми (миллисекунды)
- ✅ Тестировать изолированные функции
- ✅ Использовать минимальные моки
- ✅ Покрывать edge cases и валидацию

---

## 🚀 Порядок выполнения

1. **Создать юнит-тесты** - самые простые, начать с них
2. **Создать функциональные тесты** - перенести основные сценарии
3. **Рефакторить интеграционные** - оставить только БД-специфичные тесты
4. **Удалить дублирование** - убрать повторяющиеся проверки

## 🚨 КРИТИЧЕСКИЕ ПРОБЛЕМЫ, НАЙДЕННЫЕ ПРИ АНАЛИЗЕ

### ❌ Проблемы в `trailImport.test.ts`:

1. **TypeScript ошибки:**
   - Line 30: `Object is possibly 'undefined'` - нужно добавить `?.` оператор
   - Line 186 & 200: `Property 'trail_id' does not exist` - в новой `TrailSchema` нет поля `trail_id`

2. **Архитектурная проблема:**
   - Тесты используют `upsertStoryWithExperience()` из `persist.ts` 
   - Но план предполагает переход на `executeUpsertStory()` из `upsert-story.ts`
   - Функции имеют разные сигнатуры и поведение

3. **Схема изменилась:**
   - `TrailSchema` больше не содержит `trail_id` как обязательное поле
   - Тесты пытаются обращаться к `ongoingTrail.trail_id` который не существует
   - Нужно либо вернуть `trail_id` в схему, либо переписать тесты

### ✅ ИСПРАВЛЕНИЯ:

**1. Создан общий helper:** `tests/helpers/database-setup.ts`
- Унифицирует setup/teardown для всех интеграционных тестов
- Исправляет проблему с `Object is possibly 'undefined'`

**2. Решение проблемы с `trail_id` (РЕШЕНО):**
- Переписать тесты использовать ID, возвращённые из `executeUpsertStory()` 
- Не использовать hardcoded trail_id значения в тестах

**3. Решение проблемы с функциями (РЕШЕНО):**
- **Интеграционные тесты:** Оставить `upsertStoryWithExperience()` - тестируют БД операции
- **Функциональные тесты:** Использовать `executeUpsertStory()` - тестируют бизнес-сценарии

---

## 🚀 **MCP Server тестирование**

### 📋 **MCP Tools для тестирования:**
- `current_to_target` - поиск переходов от текущего к целевому контексту
- `current_only` - анализ прогрессии текущего контекста
- `target_only` - анализ путей к целевой позиции  
- `target_search` - поиск пользователей по целевому контексту
- `execute_upsert_story` - создание полной пользовательской истории
- `upsert_context` - создание/обновление контекста
- `upsert_trail` - создание/обновление тропы

### 🧪 **Юнит-тесты MCP (`tests/unit/mcp-server.test.ts`):**
**Что тестировать:**
- ✅ Парсинг и валидация схем параметров
- ✅ Helper функцию `tool()` - корректность создания MCP tool объектов  
- ✅ JSON serialization в ответах
- ✅ Обработка ошибок валидации

**Подход:**
- 🚫 Мокать `driver` - не использовать реальную БД
- ✅ Тестировать изолированно логику MCP server'а
- ✅ Быстрые тесты (миллисекунды)

### 🔧 **Интеграционные тесты MCP (`tests/integration/mcp-tools.test.ts`):**
**Что тестировать:**
- ✅ Каждый MCP tool с реальной Neo4j БД
- ✅ Корректность выполнения Cypher запросов через MCP
- ✅ Правильность формата ответов MCP
- ✅ Обработка ошибок БД через MCP интерфейс

**Подход:**
- ✅ Реальная Neo4j БД + тестовые данные
- ✅ Вызовы через `server.request()` или аналогичный MCP API
- 🚫 НЕ тестировать бизнес-логику - только техническую интеграцию
- ✅ Использовать `setupIntegrationTest()` для очистки БД

### 🎨 **Функциональные тесты MCP (`tests/functional/mcp-workflows.test.ts`):**
**Что тестировать:**
- ✅ Полные пользовательские сценарии через MCP
- ✅ Цепочки вызовов: create story → search contexts → analyze transitions
- ✅ End-to-end workflows как их будет использовать клиент
- ✅ Реальные данные + проверка бизнес-результатов

**Примерные сценарии:**
```typescript
test("complete career analysis workflow", async () => {
  // 1. Create user story
  await mcpServer.request("execute_upsert_story", storyData);
  
  // 2. Search for similar transitions  
  const transitions = await mcpServer.request("current_to_target", searchParams);
  
  // 3. Analyze career paths
  const analysis = await mcpServer.request("target_only", targetParams);
  
  // Verify end-to-end business result
  expect(analysis.career_paths).toBeDefined();
});
```

---

## 💡 Дополнительные требования

- Все тесты должны быть независимыми
- Каждый тест должен очищать за собой данные
- Использовать осмысленные имена тестов
- Добавить комментарии о том, что именно проверяет тест
- Следовать принципу AAA (Arrange, Act, Assert)
- **НОВОЕ:** Использовать `tests/helpers/database-setup.ts` для унификации setup/teardown
- **УДАЛЕНО:** `tests/integration/unifiedSearchRouter.test.ts` - устаревший файл с несуществующими импортами

---

## 🔍 **ЗАДАНИЕ ДЛЯ AI АССИСТЕНТА: КРИТИЧЕСКИЙ АНАЛИЗ ТЕСТОВ**

### 📋 **Контекст:**
- Все 15 интеграционных тестов сейчас проходят (`upsert-story.test.ts` + `trailImport.test.ts`)
- Исправлены основные проблемы с ID mapping и изоляцией тестов
- Но нужен **критический анализ** на предмет архитектурных проблем

### 🎯 **4 ОСНОВНЫЕ ЗАДАЧИ:**

#### **1️⃣ ПРОВЕРКА НА АДЕКВАТНОСТЬ**
Проанализируй **ВСЕ существующие тесты** в:
- `tests/integration/upsert-story.test.ts` (7 тестов)
- `tests/integration/trailImport.test.ts` (8 тестов)
- `tests/unit/scoring.test.ts`
- `tests/unit/trailValidation.test.ts`

**Что проверить:**
- ❓ Тестируют ли тесты то, что заявлено в названии?
- ❓ Есть ли логические противоречия в ожиданиях?
- ❓ Корректны ли assertions (expect statements)?
- ❓ Правильно ли используются тестовые данные?
- ❓ Есть ли race conditions или проблемы с async/await?

#### **2️⃣ КАТЕГОРИЗАЦИЯ ТЕСТОВ**
Распредели **каждый тест** по категориям:

**🧪 ЮНИТ-ТЕСТЫ (должны быть):**
- Тестируют изолированные функции
- Без реальной БД
- Быстрые (< 100ms)
- Минимальные моки

**🔧 ИНТЕГРАЦИОННЫЕ (должны быть):**
- Тестируют взаимодействие с Neo4j
- Проверяют Cypher запросы
- Используют реальную БД
- Средняя скорость (100ms - 1s)

**🎨 ФУНКЦИОНАЛЬНЫЕ (должны быть):**
- End-to-end сценарии
- Бизнес-логика через публичные API
- Полные пользовательские истории
- Медленные (> 1s)

#### **3️⃣ ВЫЯВЛЕНИЕ НЕДОСТАЮЩЕГО**
Определи **критически важные тесты**, которых НЕТ:

**Обязательно найди пропуски в:**
- Обработка ошибочных данных (invalid JSON, malformed IDs)
- Edge cases (пустые массивы, null values, очень длинные строки)
- Concurrent access (параллельные операции)
- Performance (большие объемы данных)
- Security (SQL injection в Cypher, XSS в данных)
- Schema validation failures
- Database constraint violations

#### **4️⃣ ФОРМИРОВАНИЕ ОТЧЕТА**

**Создай файл `tests/TESTING_ANALYSIS_REPORT.md` на русском языке:**

```markdown
# 🔍 Критический анализ тестового покрытия WayMates

## ❌ Что не понравилось в текущих тестах
- [Детальный список проблем с объяснением ПОЧЕМУ это проблема]

## ✅ Что нужно добавить (подробно)
### Юнит-тесты:
- [Список с объяснением ЗАЧЕМ каждый тест и ЧТО проверяем]

### Интеграционные тесты:
- [Список с объяснением ЗАЧЕМ каждый тест и ЧТО проверяем]

### Функциональные тесты:
- [Список с объяснением ЗАЧЕМ каждый тест и ЧТО проверяем]

## 📊 Результаты текущих тестов
- [Статус каждого теста: проходит/падает и ПОЧЕМУ]

## 🚨 Выявленные несостыковки в коде
- [Архитектурные проблемы, которые ДОЛЖНЫ приводить к падению тестов]
- [НЕ предлагать обходные пути - только констатировать факты]

## 🎯 Приоритеты исправления
1. [Самые критичные проблемы]
2. [Важные, но не блокирующие]
3. [Nice to have]
```

### ⚠️ **ВАЖНЫЕ ПРИНЦИПЫ:**

1. **НЕ ПОДГОНЯТЬ тесты под код** - если код неправильный, тест должен падать
2. **ВЫЯВЛЯТЬ проблемы**, не скрывать их
3. **БЫТЬ КРИТИЧНЫМ** - лучше пересоздать тест, чем оставить плохой
4. **ФОКУС НА КАЧЕСТВЕ** - цель не "зеленые тесты", а "правильные тесты"

### 📁 **Файлы для анализа:**
- `tests/integration/upsert-story.test.ts`
- `tests/integration/trailImport.test.ts` 
- `tests/unit/scoring.test.ts`
- `tests/unit/trailValidation.test.ts`
- `src/upsert-story.ts` (основная логика)
- `src/schemas-zod.ts` (схемы данных)
- `data/trails/generated_migrated/*.json` (тестовые данные)

### 🎯 **Ожидаемый результат:**
Детальный анализ с конкретными рекомендациями и выявленными проблемами, которые помогут улучшить качество кода, а не просто "позеленить" тесты.
