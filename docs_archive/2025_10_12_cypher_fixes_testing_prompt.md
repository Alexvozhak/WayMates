# 🧪 Промт для обновления тестов после исправлений Cypher запросов

**Дата:** 12 октября 2025  
**Автор:** AI Assistant  
**Цель:** Обновить существующие тесты и добавить новые для функциональности current-only после исправлений в Cypher запросах

---

## 🎯 КОНТЕКСТ ИЗМЕНЕНИЙ

В последнем коммите были внесены критические исправления в Cypher запросы для корректной работы с временными типами данных:

### ✅ Исправленные проблемы:

1. **`birth_year` поле** - исправлено обращение с `futureContext.birth_year` на `${userVar}.birth_year` (поле хранится в узле User, а не Context)

2. **Конвертация `created_at` строк** - добавлена функция `datetime()` для корректного преобразования ISO 8601 строк в временные типы Cypher:
   - `futureContext.created_at.year` → `datetime(futureContext.created_at).year`
   - `duration.between(${contextVar}.created_at, futureContext.created_at)` → `duration.between(datetime(${contextVar}.created_at), datetime(futureContext.created_at))`

3. **Архитектурные улучшения:**
   - Рефакторинг `buildContextQuery` с выделением переиспользуемого `buildSimilarContextsCore`
   - Добавление нового метода `buildCurrentBatchesQuery` для батчевого поиска current-only
   - Упрощение API с передачей полного объекта `CurrentOnlyParams`

---

## 📋 ЗАДАЧИ ДЛЯ ВЫПОЛНЕНИЯ

### 1. 🔄 ОБНОВИТЬ СУЩЕСТВУЮЩИЕ ТЕСТЫ (current-to-target)

**Файлы для обновления:**
- `tests/functional/current-to-target.test.ts`
- `tests/integration/database-operations.test.ts`
- `tests/unit/orcestrator/*.ts`

**Что нужно проверить:**
- Корректность работы `buildContextQuery` после рефакторинга
- Совместимость с новым `buildSimilarContextsCore`
- Правильность обработки временных полей в тестовых данных
- Соответствие результатов `SearchResultSchema`

### 2. 🆕 ДОБАВИТЬ НОВЫЕ ТЕСТЫ (current-only)

**Новые тестовые файлы:**
- `tests/functional/current-only-batches.test.ts`
- `tests/integration/current-only-search.test.ts`
- `tests/unit/orcestrator/current-batches-query-builder.test.ts`

**Что нужно протестировать:**

#### A. Integration тесты (С РЕАЛЬНОЙ БД):
```typescript
describe('SearchManager.searchCurrentWithBatches', () => {
  it('should return batches grouped by time periods using real Neo4j');
  it('should calculate age correctly using datetime conversion');
  it('should filter by contextTriggers from creation_reason');
  it('should handle final batch with latest contexts');
  it('should validate BatchedResearchResultSchema against real results');
});

describe('Cypher Query Execution', () => {
  it('should execute buildCurrentBatchesQuery without errors');
  it('should handle datetime() conversion in Neo4j correctly');
  it('should process duration.between() with real temporal data');
});
```

#### B. Functional тесты (ПОЛНЫЙ E2E FLOW):
```typescript
describe('Current-Only Search Flow', () => {
  it('should find similar avatars and group by progression periods');
  it('should calculate correct monthsInPositionBeforeChange');
  it('should return valid AvatarResearchResult batches');
  it('should handle complex user progression scenarios');
});
```

### 3. 📊 ТЕСТОВЫЕ ДАННЫЕ

#### 🗄️ Для Integration/Functional тестов (РЕАЛЬНЫЕ ДАННЫЕ):

**Используй существующие данные из `@generated_migrated/`:**
- `data/trails/generated_migrated/trails_user_*.json` (31 файл)
- Формат `created_at`: `"2018-03-15T00:00:00Z"` (ISO 8601)
- Поле `birth_year` в корневом объекте пользователя
- Поле `creation_reason` - массив причин создания контекста

**Загрузка данных по аналогии с существующими тестами:**
```typescript
import { loadTestData, loadAllTestData } from "../helpers/test-data-loader.js";

// Загрузка одного пользователя (ключи: "USER_001", "USER_002", ...)  
const story = loadTestData("USER_004");

// Загрузка всех пользователей для массовых тестов
const allStories = loadAllTestData();

// Подготовка данных в БД через upsertStory
await executeUpsertStory(driver, story);
```

**Если нужны новые тестовые данные:**
- Генерируй в стиле существующих файлов `trails_user_*.json`
- Используй те же поля и структуру
- Сохраняй в `data/trails/generated_migrated/`

**Ключевые сценарии для тестирования:**
- Пользователи с переходами за последние 2-3 года
- Различные `creation_reason` массивы
- Переходы между позициями (Junior → Middle → Senior)
- Смена локации, индустрии, домена

### 4. 🧪 ПРИМЕРЫ ТЕСТОВЫХ ПОДХОДОВ

#### Integration тест (с реальной БД):
```typescript
describe('SearchQueryBuilder.buildCurrentBatchesQuery', () => {
  let driver: Driver;
  let session: Session;

  beforeEach(async () => {
    ({ driver, session } = await setupIntegrationTest());
    // Загружаем реальные тестовые данные
    const stories = ["USER_001", "USER_004", "USER_015"].map(loadTestData);
    for (const story of stories) {
      await executeUpsertStory(driver, story);
    }
  });

  it('should generate correct UNION query with real parameters', () => {
    const realParams: CurrentOnlyParams = {
      currentUserId: "usr_01K6GR8JF15XP12S67QFNNNHCE",
      currentPreset: "frontend_developer",
      currentContext: loadTestData("USER_001").contexts[0],
      searchConstraints: { max_timing_diff_months: 12, results_limit: 10 },
      stepSizeMonths: 6,
      numberOfSteps: 2,
      includeFinalBatch: true,
      reasonsToTrack: ["position_changed"]
    };
    
    const result = queryBuilder.buildCurrentBatchesQuery(realParams);
    
    expect(result).toContain('UNION');
    expect(result).toContain('datetime(');
    expect(result).toContain('duration.between');
  });
});
```

#### Functional тест (с полным E2E):
```typescript
describe('SearchManager.searchCurrentWithBatches', () => {
  let driver: Driver;
  let session: Session;

  beforeEach(async () => {
    ({ driver, session } = await setupIntegrationTest());
  });

  it('should return valid batches from real Neo4j', async () => {
    // Arrange: реальные данные в тестовой БД
    const story = loadTestData("USER_001");
    await executeUpsertStory(driver, story);
    
    const realParams: CurrentOnlyParams = {
      currentUserId: story.user_id,
      currentPreset: "frontend_developer",
      currentContext: story.contexts[0],
      searchConstraints: { results_limit: 50 },
      stepSizeMonths: 6,
      numberOfSteps: 2,
      includeFinalBatch: true,
      reasonsToTrack: ["position_changed", "milestone_achieved"]
    };
    
    // Act
    const result = await searchManager.searchCurrentWithBatches(realParams);
    
    // Assert
    expect(result).toHaveLength(3); // 6mo, 12mo, final
    expect(result[0].results[0].ageAtPositionChange).toBeGreaterThan(20);
    expect(BatchedResearchResultSchema.parse(result[0])).toBeTruthy();
  });
});
```

---

## ⚠️ КРИТИЧЕСКИЕ ПРОВЕРКИ

### 1. **Временные операции:**
- Убедись что `datetime()` функция корректно обрабатывает ISO 8601 строки
- Проверь расчёт `duration.between()` с конвертированными датами
- Валидируй доступ к `.year` компоненту после `datetime()` конвертации

### 2. **Схемы данных:**
- Все результаты должны соответствовать `BatchedResearchResultSchema`
- Проверь типизацию `AvatarResearchResultSchema`
- Валидируй `NewContextReasonSchema` в `contextTriggers`

### 3. **Производительность:**
- Тестируй на больших наборах данных (20+ пользователей)
- Проверь индексы для `context_created_at` в Neo4j
- Валидируй время выполнения батчевых запросов

### 4. **Регрессии:**
- Убедись что существующие `current-to-target` тесты проходят
- Проверь совместимость `searchPipeline` с новым кодом
- Валидируй что `buildContextQuery` работает как раньше

---

## 🏗️ АРХИТЕКТУРНЫЕ ПРИНЦИПЫ

### 🎯 Разделение ответственности тестов:

#### 🔗 **Integration тесты** (tests/integration/):
- Реальная БД Neo4j (отдельный контейнер)
- Тестируют взаимодействие компонентов
- Проверяют корректность Cypher запросов
- Валидируют схемы данных против реальных результатов
- Тестируют изолированную логику методов с реальными данными

#### 🌐 **Functional тесты** (tests/functional/):
- Полный E2E flow от запроса до ответа
- Реальные данные из `generated_migrated/`
- Тестируют бизнес-сценарии пользователей
- Проверяют производительность на больших данных

### При написании тестов следуй:

1. **DRY принцип** - переиспользуй тестовые утилиты
2. **Изоляция** - каждый тест должен работать независимо
3. **Реалистичность** - используй данные близкие к продакшену
4. **Покрытие** - тестируй все edge cases и error paths
5. **Читаемость** - чёткие названия и структура тестов

### Тестовая структура:
```
tests/
├── unit/orcestrator/
│   ├── current-batches-query-builder.test.ts
│   └── search-query-builder.test.ts (обновить)
├── integration/
│   ├── current-only-search.test.ts
│   └── database-operations.test.ts (обновить)
└── functional/
    ├── current-only-batches.test.ts
    └── current-to-target.test.ts (обновить)
```

---

## 🎯 ОЖИДАЕМЫЙ РЕЗУЛЬТАТ

После выполнения всех задач:
- ✅ Все существующие тесты проходят
- ✅ Новая функциональность current-only полностью покрыта тестами  
- ✅ Временные операции работают корректно
- ✅ Нет регрессий в производительности
- ✅ Код готов к продакшену

---

## 📚 СПРАВОЧНАЯ ИНФОРМАЦИЯ

### Ключевые файлы:
- `src/orcestrator/search-query-builder.ts` - основная логика
- `src/orcestrator/cypher-builder.ts` - переиспользуемые компоненты  
- `src/search-manager.ts` - интеграционный слой
- `src/schemas-zod.ts` - схемы данных

### Типы для тестирования:
- `CurrentOnlyParams` - параметры запроса
- `BatchedResearchResult` - результат батчевого поиска
- `AvatarResearchResult` - данные об аватаре
- `NewContextReason` - причины смены контекста

**Удачи в тестировании! 🚀**
